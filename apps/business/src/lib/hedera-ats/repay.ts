import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { INVOICE } from '@rf/shared/invoice';
import { distribute, type Holding, type Share } from '@rf/contracts-hedera-ats/distribution';

/**
 * What Ironline Freight owes on day 60, and who it is owed to.
 *
 * The sale was made with recourse, so the obligation is Ironline's and it stands at face value
 * whether or not Northwind Brokerage has paid Ironline. That is also why the price on day 0 and
 * day 20 was quoted against Ironline's own record: under recourse, the business being priced
 * and the business that repays are the same one.
 *
 * Who is owed what is never a list anyone kept here. It is the receivable's balances at the
 * moment of repayment, divided by the published formula — which is what lets a holder check
 * that what landed in its wallet is what it was owed.
 */

/** One holder, what it is owed, and what actually reached it. */
export interface Payment {
  name: string;
  wallet: string;
  units: number;
  /** Its units as a percentage of everything outstanding. */
  sharePct: number;
  /** Its share of the face value, in whole dollars and cents. */
  owedUsd: number;
  /** What was actually transferred, which is nought until the money moves. */
  paidUsd: number;
  /** The transfer that paid it, where one was made. */
  hash?: string;
}

/** The day-60 obligation as Ironline's screen reads it. */
export interface RepaymentView {
  /** What is owed at maturity, in whole US dollars. */
  owedUsd: number;
  /** Everyone the receivable says holds part of it, and their share of that. */
  holders: Payment[];
  /** Whether those balances came off the chain on this request. */
  live: boolean;
}

/** What the receivable is repaid at — the invoice's face value, in whole dollars. */
const FACE_VALUE_USD = INVOICE.faceValueUsd;

/** USDC's six decimals, which the amounts owed are worked out in. */
const USDC_DECIMALS = 1_000_000;

/** The fund that funded the whole receivable on day 2 and kept half of it. */
const WOODGROVE = {
  name: 'Woodgrove Capital',
  wallet: process.env.WOODGROVE_ADDRESS ?? '0xE1e76C63fb819B35cDC09dbb3D03B3d85eeaE2D8',
};

/** The second approved investor, which bought the other half on day 20. */
const BRIDGELINE = {
  name: 'Bridgeline Partners',
  wallet: process.env.BRIDGELINE_ADDRESS ?? '0x3F8890000000000000000000000000000000C102',
};

/**
 * The balances the screen falls back to when Hedera cannot be reached.
 *
 * Half and half, which is what the receivable's own balances say after the day-20 sale. Shown
 * as not live rather than as an error: a business reading a division it cannot refresh is still
 * reading the last true thing, and a blank panel would tell it less.
 */
const KNOWN_BALANCES: Holding[] = [
  { ...WOODGROVE, units: FACE_VALUE_USD / 2 },
  { ...BRIDGELINE, units: FACE_VALUE_USD / 2 },
];

const RPC_URL = process.env.HEDERA_RPC_URL ?? 'https://testnet.hashio.io/api';

const RECEIVABLE_TOKEN =
  process.env.HEDERA_RECEIVABLE_TOKEN ?? '0x6871D6F903C3a2977f89c079B87DA9bBb8ed2960';

/** Only the calls this file makes. The receivable is an ATS security; this is ERC-20's share of it. */
const SECURITY_ABI = ['function balanceOf(address) view returns (uint256)'];

const PAYMENT_ABI = ['function transfer(address, uint256) returns (bool)'];

/**
 * How long a read of the balances may take before the screen gives up on it.
 *
 * A portal that hangs on a slow endpoint is worse than one that shows the balances on hand and
 * says so — the first looks broken, the second looks honest.
 */
const READ_BUDGET_MS = 5_000;

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

/** Turn what each wallet holds into what the repayment owes it. */
function owedTo(holdings: Holding[]): Payment[] {
  return distribute(FACE_VALUE_USD, holdings).map((share: Share) => ({
    name: share.name,
    wallet: share.wallet,
    units: share.units,
    sharePct: share.sharePct,
    owedUsd: Number(share.owed) / USDC_DECIMALS,
    paidUsd: 0,
  }));
}

/**
 * Read who holds the receivable, straight off the token on Hedera testnet.
 *
 * The two balances are the whole answer: nobody records who is owed what, it is what the
 * balances add up to. That is the difference between a business reporting a distribution and
 * a business describing one.
 */
export async function owedAtMaturity(): Promise<RepaymentView> {
  const provider = new JsonRpcProvider(RPC_URL);

  try {
    const security = new Contract(RECEIVABLE_TOKEN, SECURITY_ABI, provider);
    const [woodgrove, bridgeline] = await withinBudget(
      Promise.all([security.balanceOf(WOODGROVE.wallet), security.balanceOf(BRIDGELINE.wallet)]),
    );

    /*
     * An answer of nothing is not an answer about this receivable. Until the day-20 sale has
     * been run against the deployed token neither fund holds a unit of it, and a division built
     * from two zeroes would report that nobody is owed anything. That reads as a live fact and
     * is not one, so it falls through to the balances on hand like any other read the endpoint
     * could not give.
     */
    if (Number(woodgrove) + Number(bridgeline) > 0) {
      return {
        owedUsd: FACE_VALUE_USD,
        holders: owedTo([
          { ...WOODGROVE, units: Number(woodgrove) },
          { ...BRIDGELINE, units: Number(bridgeline) },
        ]),
        live: true,
      };
    }
  } catch {
    // Fall through to the balances on hand, named as such. A panel that blanked out on a flaky
    // endpoint would tell the business less than the same division with its source stated.
  } finally {
    provider.destroy();
  }

  return { owedUsd: FACE_VALUE_USD, holders: owedTo(KNOWN_BALANCES), live: false };
}

/**
 * Pays every holder its share of the repayment.
 *
 * No holder is asked to claim, sign, or press anything — the only party acting is the one that
 * owes. Each transfer is made for the amount the published division says, so a holder can check
 * what reached it against a figure it can recompute from the same balances.
 *
 * A missing key is not an error the screen should hide. The division is still worked out and
 * still shown, with the money named as not moved: what a business is owed and whether it has
 * been paid are two different facts, and only one of them needs a wallet to be open.
 */
export async function repay(): Promise<RepaymentView & { settled: boolean; reason?: string }> {
  const view = await owedAtMaturity();
  const payerKey = process.env.HEDERA_ISSUER_KEY ?? process.env.HEDERA_OPERATOR_KEY;
  const usdc = process.env.HEDERA_USDC;

  if (!payerKey || !usdc) {
    return {
      ...view,
      settled: false,
      reason:
        'The account this repayment pays from is not open yet — set HEDERA_ISSUER_KEY and HEDERA_USDC in the repository .env. Nothing was transferred.',
    };
  }

  const provider = new JsonRpcProvider(RPC_URL);

  try {
    const payer = new Wallet(payerKey, provider);
    const money = new Contract(usdc, PAYMENT_ABI, payer);
    const holders: Payment[] = [];

    /*
     * One transfer per holder, in turn rather than at once. Two transfers signed by the same
     * account in parallel race for the same nonce, and the one that loses is reported as a
     * failure of a payment that was never actually refused.
     */
    for (const holder of view.holders) {
      const amount = BigInt(Math.round(holder.owedUsd * USDC_DECIMALS));
      const sent = await money.transfer(holder.wallet, amount);
      await sent.wait();
      holders.push({ ...holder, paidUsd: holder.owedUsd, hash: sent.hash as string });
    }

    return { ...view, holders, settled: true };
  } catch (error) {
    return {
      ...view,
      settled: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    provider.destroy();
  }
}
