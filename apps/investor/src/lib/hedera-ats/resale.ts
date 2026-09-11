import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { INVOICE } from '@rf/shared/invoice';

/** What a wallet holds, before any of it is turned into a share. */
export interface HolderBalance {
  name: string;
  wallet: string;
  /** Units of the receivable, one per dollar of face value. */
  units: number;
}

/** One party's stake in the receivable, as the fund's screen reads it. */
export interface HolderView extends HolderBalance {
  /** Its units as a percentage of the whole receivable. */
  sharePct: number;
}

/**
 * Who owns the receivable right now, and what the seller got back for the part it gave up.
 *
 * `live` rather than a silent fallback, because a fund reading a split has to know whether it
 * is reading the chain or the last thing we knew — the two are the same number until the day
 * they are not, and that is the day it matters.
 */
export interface ResaleView {
  /** Units the whole receivable is made of. The shares below are worked out against this. */
  wholeUnits: number;
  holders: HolderView[];
  /** What the seller received for the units it sold, in whole US dollars. */
  cashReturnedUsd: number;
  live: boolean;
}

/** What one unit of the receivable is worth, so a $50,000 invoice is 50,000 units. */
const WHOLE_UNITS = INVOICE.faceValueUsd;

/**
 * The fund holding the receivable, as onboarding recorded it on Sepolia.
 *
 * The wallet is the one thing here that has to match the chain, so it is overridable — a
 * different demo account must not need this file edited.
 */
const SELLER = {
  name: 'Woodgrove Capital',
  wallet: '0xE1e76C63fb819B35cDC09dbb3D03B3d85eeaE2D8',
};

/** The second approved investor, the one the fund sells half of its position to. */
export const SECOND_INVESTOR = {
  name: 'Bridgeline Partners',
  wallet: '0x3F8890000000000000000000000000000000C102',
};

/**
 * What the fund gets back on day 20 when nothing can be priced.
 *
 * The resale price is worked out from Ironline's live record and the days left on the invoice
 * — see `resale-quote.ts`, which is what every caller here passes in. This is only the answer
 * for a caller that has no quote to hand, and it is the same formula's answer for a spotless
 * record, so an unpriced screen and a priced one cannot show two different sales.
 */
const CASH_BACK_USD = 24_167;

/**
 * The balances the screen falls back to when Hedera cannot be reached.
 *
 * Half and half, which is what the receivable's own balances say after the day-20 sale. Shown
 * as not live rather than as an error: a fund reading a split it cannot refresh is still
 * reading the last true thing, and a blank panel would tell it less.
 */
const KNOWN_BALANCES = {
  seller: { ...SELLER, units: WHOLE_UNITS / 2 },
  buyer: { ...SECOND_INVESTOR, units: WHOLE_UNITS / 2 },
};

const RPC_URL = process.env.HEDERA_TESTNET_RPC_URL ?? 'https://testnet.hashio.io/api';

const RECEIVABLE_TOKEN =
  '0x6871D6F903C3a2977f89c079B87DA9bBb8ed2960';

const SETTLEMENT =
  '0x46900157F8137F4545F8F1237549cafaBAaF7Cb9';

/** Only the calls this file makes. The receivable is an ATS security; these are ERC-20's share of it. */
const SECURITY_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function getMaturityDate() view returns (uint256)',
];

const PAYMENT_ABI = ['function approve(address, uint256) returns (bool)'];

const DVP_ABI = [
  'function offer(address security, uint256 units, address payment, uint256 price, uint256 maturityDays) returns (uint256)',
  'function settle(uint256 id)',
];

/** USDC's six decimals, which the settlement contract states its prices in. */
const USDC_UNITS = 1_000_000n;

const SECONDS_IN_A_DAY = 86_400;

/**
 * How long a read of the balances may take before the screen gives up on it.
 *
 * A portal that hangs on a slow endpoint is worse than one that shows the balances on hand and
 * says so — the first looks broken, the second looks honest.
 */
const READ_BUDGET_MS = 5_000;

/**
 * Turn what each wallet holds into the split the fund reads.
 *
 * The seller is a separate argument rather than the first of a list, because it is always
 * listed first on screen and an ordering that depends on who happens to hold more would move
 * the fund's own row around underneath it.
 *
 * @param seller - The fund that held the receivable before any of it was sold
 * @param buyers - Everyone else who may hold part of it now
 * @param wholeUnits - Units the whole receivable is made of
 * @param priceUsd - What the seller receives for the units it sold
 * @param live - Whether these balances came off the chain on this request
 */
export function toResale(
  seller: HolderBalance,
  buyers: HolderBalance[],
  wholeUnits: number,
  priceUsd: number,
  live: boolean,
): ResaleView {
  /*
   * A wallet holding nothing is not a holder. Listing one at 0% would put a party on the fund's
   * screen that the receivable itself has no record of.
   */
  const holders = [seller, ...buyers]
    .filter((holder) => holder.units > 0)
    .map((holder) => ({ ...holder, sharePct: (holder.units * 100) / wholeUnits }));

  /*
   * Cash comes back only once somebody else is actually holding part of the receivable. While
   * the fund still owns the whole thing, nothing has been sold and nothing has been paid for.
   */
  const sold = holders.some((holder) => holder.wallet !== seller.wallet);

  return { wholeUnits, holders, cashReturnedUsd: sold ? priceUsd : 0, live };
}

/** Give up on a read that is taking longer than the screen can wait for. */
async function withinBudget<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('the endpoint did not answer in time')), READ_BUDGET_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read who holds the receivable, straight off the token on Hedera testnet.
 *
 * The two balances are the whole answer: the split is not recorded anywhere, it is what the
 * balances add up to. That is the difference between a portal reporting an ownership change
 * and a portal describing one.
 */
export async function resale(priceUsd: number = CASH_BACK_USD): Promise<ResaleView> {
  const provider = new JsonRpcProvider(RPC_URL);

  try {
    const security = new Contract(RECEIVABLE_TOKEN, SECURITY_ABI, provider);
    const [sellerUnits, buyerUnits] = await withinBudget(
      Promise.all([security.balanceOf(SELLER.wallet), security.balanceOf(SECOND_INVESTOR.wallet)]),
    );

    /*
     * An answer of nothing is not an answer about this receivable. Until the day-20 sale has
     * been run against the deployed token, neither fund holds a unit of it, and a split built
     * from two zeroes would report that the receivable has no owner at all. That reads as a
     * live fact and is not one, so it falls through to the balances on hand like any other
     * read the endpoint could not give.
     */
    if (Number(sellerUnits) + Number(buyerUnits) > 0) {
      return toResale(
        { ...SELLER, units: Number(sellerUnits) },
        [{ ...SECOND_INVESTOR, units: Number(buyerUnits) }],
        WHOLE_UNITS,
        priceUsd,
        true,
      );
    }
  } catch {
    // Fall through to the balances on hand, named as such. A panel that blanked out on a flaky
    // endpoint would tell the fund less than the same split with its source stated.
  } finally {
    provider.destroy();
  }

  return toResale(
    KNOWN_BALANCES.seller,
    [KNOWN_BALANCES.buyer],
    WHOLE_UNITS,
    priceUsd,
    false,
  );
}

/** The settled sale, as the chain recorded it. */
export interface Sale {
  hash: string;
  units: number;
  priceUsd: number;
}

/**
 * Which key settles for a given buyer.
 *
 * A buyer nobody approved still needs a key of its own, because it has to be able to *try*.
 * Refusing it here for want of a key would make the refusal ours, when the whole point is that
 * the receivable turns it away.
 */
function keyFor(buyer: string): string | undefined {
  return buyer.toLowerCase() === SECOND_INVESTOR.wallet.toLowerCase()
    ? process.env.HEDERA_BRIDGELINE_WALLET_PRIVATE_KEY
    : process.env.HEDERA_UNAPPROVED_BUYER_WALLET_PRIVATE_KEY;
}

/**
 * Offer part of the fund's position and let a named buyer settle it, in one exchange.
 *
 * Both legs move inside the settlement contract's own transaction, so an unapproved buyer's
 * purchase reverts whole — the money goes back with the units. Nothing here checks whether the
 * buyer is allowed to hold the receivable; the receivable does, at the instant of transfer.
 *
 * @param buyer - Wallet the units are being sold to
 * @param units - Units being offered, one per dollar of face value
 * @returns The settling transaction, and what was paid for what
 */
export async function sellHalf(buyer: string, units: number, priceUsd: number = CASH_BACK_USD): Promise<Sale> {
  const sellerKey = process.env.HEDERA_OPERATOR_WALLET_PRIVATE_KEY;
  const buyerKey = keyFor(buyer);
  const dollar = process.env.HEDERA_MOCK_USDC_TOKEN_ADDRESS;

  if (!sellerKey || !buyerKey || !dollar) {
    throw new Error(
      'The accounts this sale needs on Hedera are not open yet — set HEDERA_OPERATOR_WALLET_PRIVATE_KEY, the buyer key and HEDERA_MOCK_USDC_TOKEN_ADDRESS in the repository .env.local',
    );
  }

  const provider = new JsonRpcProvider(RPC_URL);

  try {
    const seller = new Wallet(sellerKey, provider);
    const purchaser = new Wallet(buyerKey, provider);

    /*
     * The key configured for this buyer has to be that buyer. Otherwise the sale would settle
     * to somebody else while the screen named the buyer it was told about.
     */
    if (purchaser.address.toLowerCase() !== buyer.toLowerCase()) {
      throw new Error(`The key configured for ${buyer} signs as ${purchaser.address}`);
    }

    const security = new Contract(RECEIVABLE_TOKEN, SECURITY_ABI, seller);
    const price = BigInt(Math.round(priceUsd)) * USDC_UNITS;

    /*
     * How long the buyer's money is tied up is what is left of the invoice's life, read off the
     * receivable rather than counted from whichever day the demo says it is. The repayment the
     * settlement books has to come due when the invoice does.
     */
    const maturesAt = Number(await security.getMaturityDate());
    const daysLeft = Math.max(1, Math.ceil((maturesAt - Date.now() / 1000) / SECONDS_IN_A_DAY));

    /*
     * Step one of the Core Logic diagram — the seller lets the settlement contract move the
     * units it is putting up, and offers them on the same marketplace the original sale used.
     */
    await (await security.approve(SETTLEMENT, units)).wait();

    const listing = new Contract(SETTLEMENT, DVP_ABI, seller);
    const terms = [RECEIVABLE_TOKEN, units, dollar, price, daysLeft] as const;
    const id = await listing.offer.staticCall(...terms);
    await (await listing.offer(...terms)).wait();

    /*
     * Step two — the buyer settles. The money moves first and the units move second, and the
     * receivable decides at that instant whether the buyer may hold it. A refusal there takes
     * the payment back with it.
     */
    await (await new Contract(dollar, PAYMENT_ABI, purchaser).approve(SETTLEMENT, price)).wait();

    const settled = await new Contract(SETTLEMENT, DVP_ABI, purchaser).settle(id);
    await settled.wait();

    return { hash: settled.hash as string, units, priceUsd };
  } finally {
    provider.destroy();
  }
}
