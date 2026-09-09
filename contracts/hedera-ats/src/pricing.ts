/**
 * What a receivable sells for, worked out from things anyone can look up.
 *
 * The discount is the investor's entire return, so it is the number a buyer most needs to be
 * able to check. Deriving it from the invoice's own terms and the rating published on the
 * business's profile — rather than from a figure typed into a script — is what turns "this is
 * a fair price" from something we assert into something a stranger can recompute. It is also
 * what lets a business earn cheaper money as its record improves: the same function, run again
 * after a better rating is published, quotes a smaller discount without anything else changing.
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

/** The rate charged before any view is taken of the business, in basis points. */
const BASE_RATE_BPS = 1_200;

/**
 * What each published grade adds to the base rate, in basis points.
 *
 * The grades are the ones written to the business's profile by its appointed reviewer. An
 * invoice from a business nobody has rated is priced at the bottom of this table rather than
 * the top: an empty profile is the state every business starts in, and reading it as spotless
 * is how a platform ends up funding a stranger at its best rate.
 */
const GRADE_PREMIUM_BPS: Record<string, number> = {
  AAA: 0,
  AA: 200,
  A: 400,
  BBB: 700,
  BB: 1_100,
  B: 1_800,
  CCC: 2_800,
};

/** The premium charged when the profile carries no rating we recognise. */
const UNRATED_PREMIUM_BPS = Math.max(...Object.values(GRADE_PREMIUM_BPS));

/** What an invoice sells for, and the rate that produced it. */
export interface Quote {
  /** The grade this was priced against, after an unrecognised one falls back to the worst. */
  grade: string;
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
 * @param faceValueUsd - What the customer owes, in whole dollars
 * @param maturityDays - Days from the sale until the invoice is payable
 * @param rating - The grade published on the business's profile, empty if it has none
 */
export function priceFor(faceValueUsd: number, maturityDays: number, rating: string): Quote {
  const grade = rating.trim().toUpperCase();
  const known = grade in GRADE_PREMIUM_BPS;
  const annualRateBps = BASE_RATE_BPS + (known ? GRADE_PREMIUM_BPS[grade] : UNRATED_PREMIUM_BPS);

  /*
   * Worked in USDC's smallest unit throughout. Cents held as decimals would round a $50,000
   * invoice off by a fraction the two sides of the trade would then disagree about.
   */
  const face = BigInt(faceValueUsd) * USDC_DECIMALS;
  const discount = (face * BigInt(annualRateBps) * BigInt(maturityDays)) / (10_000n * DAYS_PER_YEAR);

  return {
    grade: known ? grade : 'unrated',
    annualRateBps,
    discount,
    price: face - discount,
  };
}
