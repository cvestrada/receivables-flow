import { describe, expect, it, vi } from 'vitest';
import { creditScore } from '@rf/contracts-ens';
import { priceFor } from '@rf/contracts-hedera-ats/pricing';

const score = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ens/score', () => ({ issuerScore: score }));

const { resaleQuote } = await import('./resale-quote');

const rated = (value: number | undefined) => ({ issuer: 'ironline', label: '', value, live: true });

/*
 * These check the two claims the resale panel makes: that the price is the published formula
 * run again rather than a figure the venue chose, and that a worse record visibly costs the
 * business money. Both are checked against `priceFor` itself, so a change to the formula
 * cannot pass here while quietly disagreeing with the number on Ironline's own screen.
 */
describe('resaleQuote', () => {
  it('prices the resale off the score standing on the profile today', async () => {
    score.mockResolvedValue(rated(100));

    const { today } = await resaleQuote();

    expect(today.score).toBe(100);
    expect(today.priceUsd).toBe(Number(priceFor(25_000, 40, 100).price) / 1_000_000);
  });

  it('prices half the position over the days that are actually left, not the full tenor', async () => {
    score.mockResolvedValue(rated(100));

    const { dayZero, today } = await resaleQuote();

    expect(dayZero.faceUsd).toBe(50_000);
    expect(dayZero.days).toBe(60);
    expect(today.faceUsd).toBe(25_000);
    expect(today.days).toBe(40);
  });

  it('holds the day-0 rate at what the sale actually happened at, whatever the record says now', async () => {
    // The rate Woodgrove paid is history. Re-deriving it from today's profile would restate
    // what the fund paid every time Ironline's record moves.
    score.mockResolvedValue(rated(50));

    const { dayZero } = await resaleQuote();

    expect(dayZero.score).toBe(100);
    expect(dayZero.annualRatePct).toBe(30);
  });

  it('makes a late payment cost the business money on the resale', async () => {
    score.mockResolvedValue(rated(100));

    const { today, ifLate } = await resaleQuote();

    expect(ifLate.score).toBe(creditScore({ financed: 7, ontime: 6, late: 1, defaulted: 0 }));
    expect(ifLate.annualRatePct).toBeGreaterThan(today.annualRatePct);
    expect(ifLate.priceUsd).toBeLessThan(today.priceUsd);
  });

  it('quotes an unrated business at the bottom of the range rather than the top', async () => {
    score.mockResolvedValue(rated(undefined));

    const { today } = await resaleQuote();

    expect(today.score).toBeNull();
    expect(today.annualRatePct).toBe(60);
  });

  it('carries through whether the score was read from the chain on this request', async () => {
    score.mockResolvedValue({ ...rated(100), live: false });

    expect((await resaleQuote()).live).toBe(false);
  });
});
