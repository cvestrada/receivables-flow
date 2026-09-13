import { INVOICE } from '@rf/shared/invoice';
import { dailyRatePct, feePct, priceFor } from '@rf/contracts-hedera-ats/pricing';
import { record, type Record } from '@/lib/ens/score';

/** Everything the page needs to show what the invoice sells for, and why. */
export interface Quote {
  /** The repayment record the price was worked out from. */
  record: Record;
  /** What the customer owes, in whole dollars. */
  faceValueUsd: number;
  /** Days from the sale until the invoice is payable. */
  maturityDays: number;
  /** The daily rate the record earned, as a percentage of face: 0.062 means 0.062% a day. */
  dailyRatePct: number;
  /** The whole fee over this invoice's term, as a percentage of face. */
  feePct: number;
  /** What the investor keeps at maturity, in whole dollars and cents. */
  discountUsd: number;
  /** What the business receives today, in whole dollars and cents. */
  proceedsUsd: number;
}

/** USDC's six decimals, which the pricing works in. */
const USDC_DECIMALS = 1_000_000;

/**
 * Work out what Ironline Freight's invoice sells for today.
 *
 * The three inputs are the invoice's face value, how long the money is tied up, and the score
 * on the company's own public profile — nothing else, and nothing typed in. That is what makes
 * the number on screen one an investor can recompute instead of one they have to accept.
 */
export async function quote(): Promise<Quote> {
  const standing = await record();
  const priced = priceFor(INVOICE.faceValueUsd, INVOICE.maturityDays, standing.score);

  return {
    record: standing,
    faceValueUsd: INVOICE.faceValueUsd,
    maturityDays: INVOICE.maturityDays,
    dailyRatePct: dailyRatePct(priced),
    feePct: feePct(priced),
    discountUsd: Number(priced.discount) / USDC_DECIMALS,
    proceedsUsd: Number(priced.price) / USDC_DECIMALS,
  };
}
