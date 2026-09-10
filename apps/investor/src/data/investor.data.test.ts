import { describe, expect, it } from 'vitest';

import { toResale, type ResaleView } from '@/lib/hedera-ats/resale';
import type { PassView } from '@/lib/ens/pass';
import type { ScoreView } from '@/lib/ens/score';
import { buildStages } from './investor.data';

const PASS: PassView = {
  name: 'woodgrove.investor.receivablesflow.eth',
  wallet: '0xE1e76C63fb819B35cDC09dbb3D03B3d85eeaE2D8',
  expiresOn: '2026-12-31',
  cleared: true,
};

const SCORE: ScoreView = { issuer: 'ironline', label: '100 of 100', value: 100, live: true };

const WHOLE = 50_000;

/** A split nothing in the data module could have been written around — the shares are not halves. */
function split(overrides: { buyerName?: string; cashUsd?: number; live?: boolean } = {}): ResaleView {
  return toResale(
    { name: 'Woodgrove Capital', wallet: PASS.wallet, units: 30_000 },
    [
      {
        name: overrides.buyerName ?? 'Harbour Lane Partners',
        wallet: '0x3F8890000000000000000000000000000000C102',
        units: 20_000,
      },
    ],
    WHOLE,
    overrides.cashUsd ?? 30_000,
    overrides.live ?? true,
  );
}

/** Everything the Day 20 screen renders, as one string to look through. */
function dayTwenty(view: ResaleView): string {
  const stage = buildStages(PASS, SCORE, view).find((s) => s.day === 'Day 20');
  return JSON.stringify(stage?.sections);
}

describe('buildStages', () => {
  it('the day-20 held share is the share reported by the resale view, not a written-in figure', () => {
    const screen = dayTwenty(split());

    expect(screen).toContain('60.00%');
    expect(screen).not.toContain('50.00%');
  });

  it('the day-20 cash returned is the figure reported by the resale view', () => {
    expect(dayTwenty(split({ cashUsd: 30_000 }))).toContain('$30,000');
    expect(dayTwenty(split({ cashUsd: 41_275 }))).toContain('$41,275');
  });

  it("the second buyer's row in the transfer log names the holder the view reports", () => {
    const screen = dayTwenty(split({ buyerName: 'Kestrel Bridge Capital' }));

    expect(screen).toContain('Kestrel Bridge Capital');
    expect(screen).not.toContain('Harbour Lane Partners');
  });

  it('when the view is not live the day-20 figures still render, marked as not live', () => {
    const screen = dayTwenty(split({ live: false }));

    expect(screen).toContain('60.00%');
    expect(screen).toContain('$30,000');
    expect(screen).toContain('Not live');
  });
});
