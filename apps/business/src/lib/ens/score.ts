import { JsonRpcProvider, Network } from 'ethers';
import { LEGACY_PAID, creditScore, readRecord, splitPaid } from '@rf/contracts-ens';
import deployed from '@rf/contracts-ens/deployed.json';

/** What Ironline Freight's public profile says about how it has paid. */
export interface Record {
  /** Invoices it has sold, whether or not they have come due. */
  financed: number;
  /** Matured invoices paid on or before the maturity date. */
  ontime: number;
  /** Matured invoices paid, but after the maturity date. */
  late: number;
  /** Matured invoices nobody paid. */
  defaulted: number;
  /**
   * What its matured invoices earned, out of 100.
   *
   * Null when nothing has matured yet, which is not the same answer as nought —
   * a business nobody has lent to has not failed, it has simply not been tested.
   */
  score: number | null;
}

/** The answer the page falls back to when the profile cannot be reached. */
const UNKNOWN: Record = { financed: 0, ontime: 0, late: 0, defaulted: 0, score: null };

interface Deployment {
  business?: { name: string; resolver: string };
}

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
 * How long the read of the profile may take before the page gives up on it.
 *
 * An endpoint that never answers is not a slow answer, it is no answer, and a page that waits
 * on one forever renders nothing at all — which is worse for the business than saying plainly
 * that its record could not be reached. The wait is bounded so the page always arrives.
 */
const READ_BUDGET_MS = 20_000;

/** Give up on a read that is taking longer than the page can wait for. */
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
 * Read Ironline Freight's repayment record from Sepolia and work out its score.
 *
 * Nothing here is a grade anyone assigned. The three counts are on the public profile, the
 * formula is one division, and the same read from anyone else's machine returns the same
 * number — which is the whole reason the price built on it can be checked rather than trusted.
 *
 * Read on each request rather than cached, because a page that held its own opinion of the
 * record could go on quoting a price the profile no longer supports.
 */
export async function record(): Promise<Record> {
  const { business } = deployed as Deployment;
  if (!business) return UNKNOWN;

  const provider = new JsonRpcProvider(RPC_URL, SEPOLIA, { staticNetwork: true });
  try {
    const text = (key: string) => readRecord(provider, business.resolver, business.name, key);

    const [financed, ontime, late, defaulted, paid] = await withinBudget(
      Promise.all([
        text('rf.invoices.financed'),
        text('rf.invoices.ontime'),
        text('rf.invoices.late'),
        text('rf.invoices.defaulted'),
        text(LEGACY_PAID),
      ]),
    );

    const counts = splitPaid({ financed, ontime, late, defaulted, paid });

    /*
     * The score is not worked out here. `creditScore` is the published formula, and a second
     * copy of the arithmetic in the portal is a second thing that can disagree with it — the
     * page has to be reading the same line a stranger would run.
     */
    return { ...counts, score: creditScore(counts) ?? null };
  } catch {
    /*
     * A public endpoint that will not answer is not the same as a business with no record,
     * but on screen both mean the same thing: no score to price against, so the invoice is
     * quoted at the bottom of the range rather than the top.
     */
    return UNKNOWN;
  } finally {
    provider.destroy();
  }
}
