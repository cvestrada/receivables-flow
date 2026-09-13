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
 * The fee is a daily rate, because that is how factoring is bought and sold.
 *
 * It used to be quoted as an annual percentage, which is the arithmetic of a loan and reads
 * like one: "35.10% a year" on a two-month invoice frightened everyone who saw it, and the
 * business it was quoted to has no year — it has sixty days. A daily rate multiplied by the
 * days the money is actually out answers the only question being asked, which is what this
 * invoice costs to sell.
 *
 * Held in hundredths of a basis point so that one point of score moves the price. At whole
 * basis points a business would repay four invoices on time and see the same number.
 */
const HUNDREDTHS_PER_BPS = 100;

/** The best daily rate, earned by a business that has repaid everything: 0.05% a day. */
const BEST_DAILY_RATE = 5 * HUNDREDTHS_PER_BPS;

/**
 * How much worse the daily rate gets across the whole range of the score.
 *
 * A business that has never repaid anything pays this on top of the best rate — 0.15% a day.
 * Everything in between is a straight line, so a business can see what one more repaid invoice
 * is worth to it without having to ask us.
 */
const RISK_SPAN_DAILY_RATE = 10 * HUNDREDTHS_PER_BPS;

/** The lowest score, which a business with no matured invoice yet is priced at. */
const WORST_SCORE = 0;

/** The highest score, which a business that has paid every matured invoice on time earns. */
const BEST_SCORE = 100;

/** What an invoice sells for, and the rate that produced it. */
export interface Quote {
  /** The score this was priced against, or null when the business has no record yet. */
  score: number | null;
  /** The daily rate charged, in hundredths of a basis point of face value. */
  dailyRate: number;
  /** The whole fee over this invoice's own term, in basis points of face value. */
  feeBps: number;
  /** What the investor keeps at maturity, in USDC's six decimals. */
  discount: bigint;
  /** What the investor pays today, in USDC's six decimals. */
  price: bigint;
}

/** The daily rate as a percentage, the way the screen writes it: 0.062 means 0.062% a day. */
export function dailyRatePct(quote: Quote): number {
  return quote.dailyRate / (HUNDREDTHS_PER_BPS * 100);
}

/** The whole fee as a percentage of face, the way the screen writes it: 3.72 means 3.72%. */
export function feePct(quote: Quote): number {
  return quote.feeBps / 100;
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
  const dailyRate = BEST_DAILY_RATE + Math.round((RISK_SPAN_DAILY_RATE * (BEST_SCORE - rated)) / BEST_SCORE);

  /* The whole fee is the daily rate times the days the money is out. Nothing else is in it. */
  const feeBps = Math.round((dailyRate * maturityDays) / HUNDREDTHS_PER_BPS);

  /*
   * Worked in USDC's smallest unit throughout. Cents held as decimals would round a $50,000
   * invoice off by a fraction the two sides of the trade would then disagree about.
   */
  const face = BigInt(faceValueUsd) * USDC_DECIMALS;
  const discount = (face * BigInt(dailyRate) * BigInt(maturityDays)) / (10_000n * BigInt(HUNDREDTHS_PER_BPS));

  return {
    score: score === null ? null : rated,
    dailyRate,
    feeBps,
    discount,
    price: face - discount,
  };
}
