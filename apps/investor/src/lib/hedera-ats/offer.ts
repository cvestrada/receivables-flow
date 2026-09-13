import { Contract, JsonRpcProvider } from 'ethers';
import deployed from '@rf/contracts-hedera-ats/deployed.json';
import { feePct, priceFor } from '@rf/contracts-hedera-ats/pricing';
import { openedAccounts } from '@rf/privy/accounts';
import { INVOICE } from '@rf/shared/invoice';

/**
 * What is on offer to this fund right now, read off the receivable itself.
 *
 * An invoice is offered from the moment the company mints it until the fund buys it — which is
 * exactly the span in which the company's own account holds the units. So the offer is the
 * company's balance, and nothing else: no stage a presenter has to arrow to, no list anyone
 * keeps. The tab said "nothing offered" over a freshly minted receivable because it was reading
 * a walkthrough instead of the chain.
 */
export interface Offer {
  receivable: string;
  issuer: string;
  /** Units the company still holds — the whole invoice, until it is bought. */
  units: number;
  faceUsd: number;
  /** What the fund pays, priced off the issuer's record today. */
  priceUsd: number;
  feePct: number;
  maturityDays: number;
  score: number | null;
  live: boolean;
}

const RPC_URL = process.env.HEDERA_TESTNET_RPC_URL ?? 'https://testnet.hashio.io/api';
const UNIT = 1_000_000;

function token(): string {
  const address = (deployed as { hederaTestnet?: { receivableToken?: string } }).hederaTestnet
    ?.receivableToken;
  if (!address) throw new Error('No receivable token recorded');
  return address;
}

/**
 * The offer, or nothing when the company holds no units.
 *
 * @param score - The issuer's score today, so the price is the one the business was quoted
 */
export async function offered(score: number | null): Promise<Offer | undefined> {
  const provider = new JsonRpcProvider(RPC_URL, { name: 'hedera-testnet', chainId: 296 }, { staticNetwork: true });

  try {
    const security = new Contract(token(), ['function balanceOf(address) view returns (uint256)'], provider);
    const held = (await security.balanceOf(openedAccounts().company.address)) as bigint;
    if (held === 0n) return undefined;

    const priced = priceFor(INVOICE.faceValueUsd, INVOICE.maturityDays, score);

    return {
      receivable: 'RCV-0001',
      issuer: 'Ironline Freight',
      units: Number(held) / UNIT,
      faceUsd: INVOICE.faceValueUsd,
      priceUsd: Number(priced.price) / UNIT,
      feePct: feePct(priced),
      maturityDays: INVOICE.maturityDays,
      score,
      live: true,
    };
  } catch {
    return undefined;
  } finally {
    provider.destroy();
  }
}
