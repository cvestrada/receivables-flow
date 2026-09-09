/**
 * What a receivable sells for, worked out from things anyone can look up.
 *
 * The discount is the investor's entire return, so it is the number a buyer most needs to be
 * able to check. Deriving it from the invoice's own terms and the score published on the
 * business's profile — rather than from a figure typed into a script — is what turns "this is
 * a fair price" from something we assert into something a stranger can recompute. It is also
 * what lets a business earn cheaper money as its record improves: the same function, run again
 * after another invoice is repaid, quotes a smaller discount without anything else changing.
 */

/** USDC's six decimals, which every amount here is expressed in. */
const USDC_DECIMALS = 1_000_000n;

/**
 * Days in a year, for working out how much of the annual rate an invoice has earned.
 *
 * Money-market discount rates are quoted against a 360-day year, so pricing a 60-day invoice
 * against 365 would quote one rate and charge another.
 */
const DAYS_PER_YEAR = 360n;

/** The best rate on offer, in basis points, earned by a business that has repaid everything. */
const BEST_RATE_BPS = 3_000;

/**
 * How much worse the rate gets across the whole range of the score, in basis points.
 *
 * A business that has defaulted on everything pays this on top of the best rate. Everything in
 * between is a straight line, so a business can see what one more repaid invoice is worth to
 * it without having to ask us.
 */
const RISK_SPAN_BPS = 3_000;

/** The lowest score, which a business with no matured invoice yet is priced at. */
const WORST_SCORE = 0;

/** The highest score, which a business that has never missed a payment earns. */
const BEST_SCORE = 100;

/** What an invoice sells for, and the rate that produced it. */
export interface Quote {
  /** The score this was priced against, or null when the business has no record yet. */
  score: number | null;
  /** The annual rate charged, in basis points. */
  annualRateBps: number;
  /** What the investor keeps at maturity, in USDC's six decimals. */
  discount: bigint;
  /** What the investor pays today, in USDC's six decimals. */
  price: bigint;
}

/**
 * Prices one invoice for sale.
 *
 * An unrated business — one with no matured invoice behind it — is priced at the bottom of the
 * range rather than the top. Being unrated is the state every business starts in, and reading
 * it as a clean record is how a platform ends up funding a stranger at its best rate. It still
 * comes back as unrated rather than as a score of nought, because the two mean different
 * things even where they cost the same.
 *
 * @param faceValueUsd - What the customer owes, in whole dollars
 * @param maturityDays - Days from the sale until the invoice is payable
 * @param score - The business's published score out of 100, or null if it has no record yet
 */
export function priceFor(faceValueUsd: number, maturityDays: number, score: number | null): Quote {
  const rated = score === null ? WORST_SCORE : Math.min(Math.max(Math.round(score), WORST_SCORE), BEST_SCORE);
  const annualRateBps = BEST_RATE_BPS + Math.round((RISK_SPAN_BPS * (BEST_SCORE - rated)) / BEST_SCORE);

  /*
   * Worked in USDC's smallest unit throughout. Cents held as decimals would round a $50,000
   * invoice off by a fraction the two sides of the trade would then disagree about.
   */
  const face = BigInt(faceValueUsd) * USDC_DECIMALS;
  const discount = (face * BigInt(annualRateBps) * BigInt(maturityDays)) / (10_000n * DAYS_PER_YEAR);

  return {
    score: score === null ? null : rated,
    annualRateBps,
    discount,
    price: face - discount,
  };
}
