/**
 * What each holder of a receivable is owed when it is repaid.
 *
 * A receivable that has been resold is owed to more than one party, and none of them agreed to
 * trust the others' arithmetic. Deriving each share from the balances the security itself
 * reports — rather than from a schedule somebody kept — is what makes a distribution checkable
 * by the people receiving it: anyone can read the balances, run this, and see whether what
 * landed in their wallet is what they were owed.
 *
 * It is deliberately the same shape as `pricing.ts`. Both are figures the platform publishes
 * about somebody else's money, and both are worth more for being recomputable than for being
 * right the first time.
 */

/** USDC's six decimals, which every amount here is expressed in. */
const USDC_DECIMALS = 1_000_000n;

/** What one wallet holds of a receivable, as the security reports it. */
export interface Holding {
  name: string;
  wallet: string;
  /** Units held. One unit is one dollar of face value. */
  units: number;
}

/** One holder, and what the repayment owes it. */
export interface Share extends Holding {
  /** Its units as a percentage of everything outstanding. */
  sharePct: number;
  /** What it is owed, in USDC's six decimals. */
  owed: bigint;
}

/**
 * Divides a repayment across everyone holding the receivable.
 *
 * The parts add up to the face value exactly. A division that paid out more would be inventing
 * money, and one that paid out less would strand the difference with nobody able to claim it —
 * so the remainder left by units that will not divide evenly is handed to the largest holder
 * rather than dropped. Largest rather than first, because first is an artefact of how the
 * balances happened to be read.
 *
 * A wallet holding nothing is not a holder and is left out entirely: it is owed nothing, and
 * listing it at nought would put a party in a distribution the receivable has no record of.
 *
 * @param faceValueUsd - What is being repaid, in whole dollars
 * @param holdings - What each wallet holds, straight off the security
 */
export function distribute(faceValueUsd: number, holdings: Holding[]): Share[] {
  const held = holdings.filter((holder) => holder.units > 0);
  const outstanding = held.reduce((units, holder) => units + holder.units, 0);

  /*
   * A receivable nobody holds is not one that owes everybody everything — it is one the chain
   * has no answer about yet. Saying so beats dividing by nothing.
   */
  if (outstanding === 0) return [];

  const face = BigInt(faceValueUsd) * USDC_DECIMALS;

  const shares = held.map((holder) => ({
    ...holder,
    sharePct: (holder.units * 100) / outstanding,
    owed: (face * BigInt(holder.units)) / BigInt(outstanding),
  }));

  const remainder = face - shares.reduce((paid, holder) => paid + holder.owed, 0n);
  if (remainder > 0n) {
    const largest = shares.reduce((most, holder) => (holder.units > most.units ? holder : most));
    largest.owed += remainder;
  }

  return shares;
}
