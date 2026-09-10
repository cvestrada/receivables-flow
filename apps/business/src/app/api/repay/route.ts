import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { INVOICE } from '@rf/shared/invoice';
import { priceFor } from '@rf/contracts-hedera-ats/pricing';
import { publish } from '@/lib/ens/outcome';
import type { Record as Standing } from '@/lib/ens/score';
import { owedAtMaturity, repay, type Payment } from '@/lib/hedera-ats/repay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * Where day 60 is remembered.
 *
 * A repayment has to survive the request that made it — otherwise pressing the button twice
 * pays every holder twice, and the second payment would look exactly as legitimate as the
 * first. A file is enough: it holds nothing secret, and it outlives the dev server reloading
 * between the two presses in a way memory would not.
 */
const STORE = '.repayment.json';

/** How day 60 ended: the obligation met, or not met. */
export type Outcome = 'repaid' | 'defaulted';

/** USDC's six decimals, which the pricing works in. */
const USDC_DECIMALS = 1_000_000;

/** A record on Ironline's page, and what the next invoice costs when priced against it. */
export interface Standpoint {
  record: Standing;
  /** The annual rate that record earns, as a percentage. */
  annualRatePct: number;
  /** What the next invoice's buyer keeps at maturity, in dollars — the cost of selling it. */
  discountUsd: number;
}

/** What day 60 did to Ironline's public record, and to the price of its next invoice. */
export interface Consequence {
  before: Standpoint;
  after: Standpoint;
  /** Whether the new record is on the page, or only worked out here. */
  published: boolean;
  reason?: string;
}

/**
 * Price the next invoice against one record.
 *
 * The same published function the day-0 quote uses, run twice against two records — which is
 * the only honest way to show that a price moved because a record moved, rather than because a
 * second number was chosen to make a point.
 */
function pricedAgainst(record: Standing): Standpoint {
  const quote = priceFor(INVOICE.faceValueUsd, INVOICE.maturityDays, record.score);

  return {
    record,
    annualRatePct: quote.annualRateBps / 100,
    discountUsd: Number(quote.discount) / USDC_DECIMALS,
  };
}

/** What Ironline's screen gets back from one attempt to end day 60. */
export interface RepaymentAnswer {
  outcome: Outcome;
  /** What was owed at maturity, in whole US dollars. */
  owedUsd: number;
  /** Every holder, and its share of that — paid on a repayment, lost on a default. */
  holders: Payment[];
  /** Whether the balances behind those shares came off the chain. */
  live: boolean;
  /** Whether the money actually moved. False on a default, and on a repayment nothing could sign. */
  settled: boolean;
  reason?: string;
  /** True when this outcome was already recorded and is being reported rather than repeated. */
  already: boolean;
  /** What the ending did to Ironline's public record, and to its next invoice. */
  consequence?: Consequence;
}

function recorded(): RepaymentAnswer | null {
  try {
    return JSON.parse(readFileSync(STORE, 'utf8')) as RepaymentAnswer;
  } catch {
    return null;
  }
}

function keep(answer: RepaymentAnswer): RepaymentAnswer {
  writeFileSync(STORE, `${JSON.stringify(answer, null, 2)}\n`);
  return answer;
}

/**
 * Add the ending to Ironline's public record and price the next invoice off it.
 *
 * The order matters: the record is written first and read back, and only then is the next
 * invoice priced — a price quoted from the record we meant to write would be a claim about the
 * page rather than a reading of it.
 */
async function consequenceOf(outcome: Outcome, hash?: string): Promise<Consequence> {
  const written = await publish(outcome, hash);

  return {
    before: pricedAgainst(written.before),
    after: pricedAgainst(written.after),
    published: written.published,
    reason: written.reason,
  };
}

/**
 * Ends day 60 one way or the other, and records which.
 *
 * Repaying divides the face value across whoever the receivable says holds it and pays each one.
 * Not repaying marks it defaulted and states the same shares as losses — the holders lose in
 * exactly the proportions they would have been paid in, which is the point of showing it.
 *
 * An outcome already recorded is reported back rather than repeated — including what it did to
 * Ironline's public record, which is written down with it. Day 60 happens once, and a record
 * that could be added to twice would be a record a business could inflate by pressing a button.
 */
export async function POST(request: Request) {
  const { outcome } = (await request.json()) as { outcome?: Outcome };

  const already = recorded();
  if (already) return NextResponse.json({ ...already, already: true } satisfies RepaymentAnswer);

  if (outcome === 'defaulted') {
    const view = await owedAtMaturity();

    return NextResponse.json(
      keep({
        outcome: 'defaulted',
        owedUsd: view.owedUsd,
        holders: view.holders,
        live: view.live,
        settled: false,
        already: false,
        consequence: await consequenceOf('defaulted'),
      }),
    );
  }

  const paid = await repay();

  return NextResponse.json(
    keep({
      outcome: 'repaid',
      owedUsd: paid.owedUsd,
      holders: paid.holders,
      live: paid.live,
      settled: paid.settled,
      reason: paid.reason,
      already: false,
      consequence: await consequenceOf('repaid', paid.holders[0]?.hash),
    }),
  );
}

/**
 * Forgets the recorded outcome, so day 60 can be walked through again.
 *
 * Here because this portal is demonstrated more than once, and a screen stuck on the first
 * ending it was shown cannot show the second. It clears what was written down; it does not
 * unpay anybody.
 */
export async function DELETE() {
  rmSync(STORE, { force: true });

  return NextResponse.json({ cleared: true });
}
