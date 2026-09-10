import { describe, expect, it, vi } from 'vitest';

import { resale, toResale, type HolderBalance } from './resale';

/*
 * Nothing here is allowed to reach Hedera. The one test that asks what an unreachable
 * endpoint does needs the endpoint to be unreachable on purpose rather than by luck, and the
 * rest would be checking somebody's uptime instead of this file's arithmetic.
 */
vi.mock('ethers', () => ({
  JsonRpcProvider: class {
    destroy() {}
  },
  Contract: class {
    balanceOf(): Promise<bigint> {
      return Promise.reject(new Error('could not detect network'));
    }
  },
  Wallet: class {},
  ZeroAddress: '0x0000000000000000000000000000000000000000',
}));

const WHOLE = 50_000;
const PRICE = 24_150;

const WOODGROVE: HolderBalance = {
  name: 'Woodgrove Capital',
  wallet: '0xE1e76C63fb819B35cDC09dbb3D03B3d85eeaE2D8',
  units: 25_000,
};

const BRIDGELINE: HolderBalance = {
  name: 'Bridgeline Partners',
  wallet: '0x3F8890000000000000000000000000000000C102',
  units: 25_000,
};

describe('resale', () => {
  it('both holders of the receivable are reported, with the seller listed first', () => {
    const view = toResale(
      { ...WOODGROVE, units: 10_000 },
      [{ ...BRIDGELINE, units: 40_000 }],
      WHOLE,
      PRICE,
      true,
    );

    expect(view.holders.map((holder) => holder.name)).toEqual([
      'Woodgrove Capital',
      'Bridgeline Partners',
    ]);
  });

  it("each holder's share is its units as a proportion of the whole receivable", () => {
    const view = toResale({ ...WOODGROVE, units: 12_500 }, [{ ...BRIDGELINE, units: 37_500 }], WHOLE, PRICE, true);

    expect(view.holders.map((holder) => holder.sharePct)).toEqual([25, 75]);
  });

  it('the two shares sum to the whole receivable — selling part creates no units and destroys none', () => {
    const view = toResale(WOODGROVE, [BRIDGELINE], WHOLE, PRICE, true);

    expect(view.holders.reduce((total, holder) => total + holder.sharePct, 0)).toBe(100);
    expect(view.holders.reduce((total, holder) => total + holder.units, 0)).toBe(WHOLE);
  });

  it('the cash returned to the seller is the price the offer settled at', () => {
    const view = toResale(WOODGROVE, [BRIDGELINE], WHOLE, PRICE, true);

    expect(view.cashReturnedUsd).toBe(PRICE);
  });

  it('a wallet holding no units is not reported as a holder', () => {
    const view = toResale(WOODGROVE, [{ ...BRIDGELINE, units: 0 }], WHOLE, PRICE, true);

    expect(view.holders.map((holder) => holder.name)).toEqual(['Woodgrove Capital']);
  });

  it('a receivable still wholly owned by one fund reports a single holder at 100%', () => {
    const view = toResale({ ...WOODGROVE, units: WHOLE }, [{ ...BRIDGELINE, units: 0 }], WHOLE, PRICE, true);

    expect(view.holders).toHaveLength(1);
    expect(view.holders[0].sharePct).toBe(100);
    expect(view.cashReturnedUsd).toBe(0);
  });

  it('when the chain cannot be reached the known balances are reported and the view says it is not live', async () => {
    const view = await resale();

    expect(view.live).toBe(false);
    expect(view.holders.map((holder) => holder.name)).toEqual([
      'Woodgrove Capital',
      'Bridgeline Partners',
    ]);
    expect(view.holders.reduce((total, holder) => total + holder.units, 0)).toBe(view.wholeUnits);
  });
});
