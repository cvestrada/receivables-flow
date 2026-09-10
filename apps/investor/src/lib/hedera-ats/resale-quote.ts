import { INVOICE } from '@rf/shared/invoice';
import { creditScore } from '@rf/contracts-ens';
import { priceFor } from '@rf/contracts-hedera-ats/pricing';
import { issuerScore, type ScoreView } from '@/lib/ens/score';

/** One price, and the whole of the working that produced it. */
export interface Leg {
  /** The score it was priced against, or null for a business with no record yet. */
  score: number | null;
  /** The annual rate that score earns, as a percentage. */
  annualRatePct: number;
  /** Face value being priced, in whole US dollars. */
  faceUsd: number;
  /** Days from the sale until that face value is payable. */
  days: number;
  /** What the buyer pays, in dollars and cents. */
  priceUsd: number;
}

/** The day-0 sale and the day-20 resale, priced the same way and shown together. */
export interface ResaleQuote {
  /** What the whole invoice sold for when Woodgrove funded it. */
  dayZero: Leg;
  /** What half of it clears at today, off Ironline's record as it stands now. */
  today: Leg;
  /** The same half, priced off a record carrying one late payment. */
  ifLate: Leg;
  /** Whether today's score came off Sepolia on this request. */
  live: boolean;
}

/** USDC's six decimals, which the pricing works in. */
const USDC_DECIMALS = 1_000_000;

/**
 * The score on Ironline Freight's profile the day the invoice was funded.
 *
 * Recorded rather than read, because the day-0 rate is history: it is the rate the sale
 * actually happened at, and re-deriving it from today's record would quietly restate what
 * Woodgrove paid every time the profile moves. The resale beside it is the live number.
 */
const SCORE_AT_ISSUANCE = 100;

/** Day of the invoice's life the position is sold on. */
const RESALE_DAY = 20;

/**
 * A record with one late payment on it, used to show what the rating is worth.
 *
 * Six invoices paid on time and a seventh paid late is the smallest change that moves
 * Ironline off a spotless record, and it is the outcome the settlement lane will actually
 * write. Priced beside today's number so a fund can see the rating doing the work rather
 * than being told that it does.
 */
const ONE_LATE = { financed: 7, ontime: 6, late: 1, defaulted: 0 };

/** Half the position, which is what the fund sells on day 20. */
const HALF_FACE_USD = INVOICE.faceValueUsd / 2;

/** Price one leg and state the working alongside it. */
function leg(faceUsd: number, days: number, score: number | null): Leg {
  const priced = priceFor(faceUsd, days, score);

  return {
    score: priced.score,
    annualRatePct: priced.annualRateBps / 100,
    faceUsd,
    days,
    priceUsd: Number(priced.price) / USDC_DECIMALS,
  };
}

/**
 * What half of Woodgrove's position is worth on day 20, and why that is not the day-0 rate.
 *
 * The resale is quoted, not matched. An invoice is its own instrument — there is no second
 * $50,000 Ironline receivable maturing on the same day for a book to price against — so the
 * venue publishes a price with the formula behind it and the buyer takes it or does not. What
 * makes that honest rather than convenient is that the formula is the same one the invoice was
 * funded under, run again on the record as it stands today and the days that are actually left.
 *
 * Two things move the number and the screen has to keep them apart: forty days of carry
 * instead of sixty, and whatever Ironline's paying has done to its score since. The first is
 * arithmetic anybody expects. The second is the entire claim of the project.
 */
export async function resaleQuote(read?: ScoreView): Promise<ResaleQuote> {
  /*
   * The caller passes the score it has already read wherever it has one. Reading the profile
   * a second time on the same request would put two answers about the same business on one
   * screen the moment the record changed between them.
   */
  const { value, live } = read ?? (await issuerScore());
  const score = value ?? null;
  const daysLeft = INVOICE.maturityDays - RESALE_DAY;

  return {
    dayZero: leg(INVOICE.faceValueUsd, INVOICE.maturityDays, SCORE_AT_ISSUANCE),
    today: leg(HALF_FACE_USD, daysLeft, score),
    ifLate: leg(HALF_FACE_USD, daysLeft, creditScore(ONE_LATE) ?? null),
    live,
  };
}
