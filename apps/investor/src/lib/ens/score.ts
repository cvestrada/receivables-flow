import { JsonRpcProvider, Network } from 'ethers';
import { ONBOARD_COUNTS, creditScore, readCounts, type Counts } from '@rf/contracts-ens';
import deployed from '@rf/contracts-ens/deployed.json';

/**
 * What the fund sees where a credit grade used to sit.
 *
 * `label` rather than a bare number, because "unrated" is a real answer here and rendering it
 * as 0 would tell a fund the opposite of the truth about a business nobody has data on yet.
 */
export interface ScoreView {
  issuer: string;
  label: string;
  value: number | undefined;
  /**
   * The record the number was worked out from.
   *
   * Carried alongside the score because some questions are about the record and not the
   * number: what one more late payment would do to this business cannot be answered from a
   * score alone, and answering it from a record somebody typed would be answering it about a
   * different company.
   */
  counts: Counts;
  /** Whether the counts behind the number came off the chain on this request. */
  live: boolean;
}

interface Deployment {
  businesses?: { baseName: string; registry: string };
  business?: { name: string };
}

/**
 * Ironline's record as the portal knows it without asking the chain.
 *
 * Used only when there is no deployment to read or the endpoint is unreachable. The counts are
 * the fallback, never the score: the number is computed from them by the same published
 * function either way, so an offline screen cannot show a grade the formula would not produce.
 *
 * It is the record onboarding writes, taken from the package rather than written here. A
 * fallback of its own invention would put a business on screen that the chain has never held —
 * this one was a spotless six-for-six while the chain said otherwise, which is how the price
 * on an offline screen came to disagree with the price on a live one.
 */
const KNOWN_COUNTS: Counts = ONBOARD_COUNTS;

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';

/**
 * The chain, stated rather than discovered.
 *
 * Left to work it out, the provider spends a round trip asking the endpoint what network it is
 * on before every read, and retries that question when the answer is slow — which is most of
 * the time this page spends waiting. We already know: the deployment says Sepolia.
 */
const SEPOLIA = new Network('sepolia', 11_155_111);

/**
 * How long a read of the record may take before the screen gives up on it.
 *
 * A public endpoint that never answers is not a slow answer, it is no answer, and a portal
 * that waits on one forever renders nothing at all. The counts on hand are worse than a live
 * read and far better than a blank page, so the wait is bounded and the source is named.
 */
const READ_BUDGET_MS = 20_000;

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

/** How the number reads on screen — out of 100, or plainly unrated. */
function describe(value: number | undefined): string {
  return value === undefined ? 'Unrated' : `${value} of 100`;
}

/**
 * Work out the issuer's credit score for the offer in front of this fund.
 *
 * The fund does the sum itself rather than being handed a grade. Nothing here asks Receivables
 * Flow what it thinks of Ironline — the counts are public, the formula is published, and this
 * is the same arithmetic any counterparty would run before pricing the same invoice.
 */
export async function issuerScore(): Promise<ScoreView> {
  const { businesses, business } = deployed as Deployment;
  const issuer = business?.name.split('.')[0] ?? 'ironline';

  if (businesses) {
    const provider = new JsonRpcProvider(RPC_URL, SEPOLIA, { staticNetwork: true });
    try {
      const counts = (await withinBudget(readCounts(provider, businesses, issuer))) ?? KNOWN_COUNTS;
      const value = creditScore(counts);
      return { issuer, label: describe(value), value, counts, live: true };
    } catch {
      // Fall through to the counts on hand. A screen that blanked out on a flaky endpoint
      // would be worse than one that shows the same number with its source named.
    } finally {
      provider.destroy();
    }
  }

  const value = creditScore(KNOWN_COUNTS);
  return { issuer, label: describe(value), value, counts: KNOWN_COUNTS, live: false };
}
