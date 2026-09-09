import { JsonRpcProvider } from 'ethers';
import { readRecord } from '@rf/contracts-ens';
import deployed from '@rf/contracts-ens/deployed.json';

/** What Ironline Freight's public profile says about how it has paid. */
export interface Record {
  /** Invoices it has sold, whether or not they have come due. */
  financed: number;
  /** Matured invoices the customer paid. */
  repaid: number;
  /** Matured invoices nobody paid. */
  defaulted: number;
  /**
   * The share of matured invoices repaid, out of 100.
   *
   * Null when nothing has matured yet, which is not the same answer as nought —
   * a business nobody has lent to has not failed, it has simply not been tested.
   */
  score: number | null;
}

/** The answer the page falls back to when the profile cannot be reached. */
const UNKNOWN: Record = { financed: 0, repaid: 0, defaulted: 0, score: null };

interface Deployment {
  business?: { name: string; resolver: string };
}

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';

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

  const provider = new JsonRpcProvider(RPC_URL);
  try {
    const count = async (key: string) =>
      Number(await readRecord(provider, business.resolver, business.name, key)) || 0;

    const [financed, repaid, defaulted] = await Promise.all([
      count('rf.invoices.financed'),
      count('rf.invoices.repaid'),
      count('rf.invoices.defaulted'),
    ]);

    const matured = repaid + defaulted;
    return {
      financed,
      repaid,
      defaulted,
      score: matured === 0 ? null : Math.round((repaid * 100) / matured),
    };
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
