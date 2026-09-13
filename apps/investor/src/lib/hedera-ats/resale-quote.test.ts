import { describe, expect, it, vi } from 'vitest';
import { creditScore, type Counts } from '@rf/contracts-ens';
import { priceFor } from '@rf/contracts-hedera-ats/pricing';

const score = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ens/score', () => ({ issuerScore: score }));

const { resaleQuote } = await import('./resale-quote');

/*
 * A profile with a real record behind it, because the panel now prices its "if late" row off
 * the counts rather than off the score. A stub that carried a score with no record would let
 * a hypothetical be priced against a business that does not exist.
 */
const rated = (counts: Counts) => ({
  issuer: 'ironline',
  label: '',
  value: creditScore(counts),
  counts,
  live: true,
});

/** Seven invoices, all paid on time — the spotless record, which scores 100. */
const SPOTLESS: Counts = { financed: 7, ontime: 7, late: 0, defaulted: 0 };

/** One paid, one never paid, which scores 50. */
const HALF: Counts = { financed: 2, ontime: 1, late: 0, defaulted: 1 };

/** Nothing matured yet, which is unrated rather than nought. */
const NEW: Counts = { financed: 1, ontime: 0, late: 0, defaulted: 0 };

/*
 * These check the two claims the resale panel makes: that the price is the published formula
 * run again rather than a figure the venue chose, and that a worse record visibly costs the
 * business money. Both are checked against `priceFor` itself, so a change to the formula
 * cannot pass here while quietly disagreeing with the number on Ironline's own screen.
 */
describe('resaleQuote', () => {
  it('prices the resale off the score standing on the profile today', async () => {
    score.mockResolvedValue(rated(SPOTLESS));

    const { today } = await resaleQuote();

    expect(today.score).toBe(100);
    expect(today.priceUsd).toBe(Number(priceFor(25_000, 40, 100).price) / 1_000_000);
  });

  it('prices half the position over the days that are actually left, not the full tenor', async () => {
    score.mockResolvedValue(rated(SPOTLESS));

    const { dayZero, today } = await resaleQuote();

    expect(dayZero.faceUsd).toBe(50_000);
    expect(dayZero.days).toBe(60);
    expect(today.faceUsd).toBe(25_000);
    expect(today.days).toBe(40);
  });

  it('prices day 0 at the score the business actually had, not at a perfect one', async () => {
    // The row used to hardcode 100 — "bought at 3.00%, $48,500" — while the business had just
    // been quoted $47,990 at 83 on its own screen. The fund paid the price the record earned.
    score.mockResolvedValue(rated(HALF));

    const { dayZero } = await resaleQuote();

    expect(dayZero.score).toBe(50);
    expect(dayZero.dailyRatePct).toBe(0.1);
  });

  it('makes a late payment cost the business money on the resale', async () => {
    score.mockResolvedValue(rated(SPOTLESS));

    const { today, ifLate } = await resaleQuote();

    expect(ifLate.score).toBe(creditScore({ financed: 8, ontime: 7, late: 1, defaulted: 0 }));
    expect(ifLate.dailyRatePct).toBeGreaterThan(today.dailyRatePct);
    expect(ifLate.priceUsd).toBeLessThan(today.priceUsd);
  });

  it('quotes an unrated business at the bottom of the range rather than the top', async () => {
    score.mockResolvedValue(rated(NEW));

    const { today } = await resaleQuote();

    expect(today.score).toBeNull();
    expect(today.dailyRatePct).toBe(0.15);
  });

  it('carries through whether the score was read from the chain on this request', async () => {
    score.mockResolvedValue({ ...rated(SPOTLESS), live: false });

    expect((await resaleQuote()).live).toBe(false);
  });
});
