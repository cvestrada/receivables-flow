import { expect } from 'chai';
import { distribute } from '../src/distribution';

/** Ironline Freight's invoice — the face value that has to be divided on day 60. */
const FACE_VALUE_USD = 50_000;

/** USDC's six decimals, which every amount owed is expressed in. */
const USDC = 1_000_000n;

const WOODGROVE = { name: 'Woodgrove Capital', wallet: '0xE1e76C63fb819B35cDC09dbb3D03B3d85eeaE2D8' };
const BRIDGELINE = { name: 'Bridgeline Partners', wallet: '0x3F8890000000000000000000000000000000C102' };

/** What the two funds hold after the day-20 sale — half the receivable each. */
function halfAndHalf() {
  return [
    { ...WOODGROVE, units: FACE_VALUE_USD / 2 },
    { ...BRIDGELINE, units: FACE_VALUE_USD / 2 },
  ];
}

/** Everything the division hands out, added up. */
function total(owed: { owed: bigint }[]): bigint {
  return owed.reduce((sum, holder) => sum + holder.owed, 0n);
}

describe('distribute', () => {
  it('owes two holders of half a $50,000 receivable $25,000 each', () => {
    const owed = distribute(FACE_VALUE_USD, halfAndHalf());

    expect(owed).to.have.length(2);
    expect(owed[0].owed).to.equal(25_000n * USDC);
    expect(owed[1].owed).to.equal(25_000n * USDC);
  });

  it('owes a holder of a quarter of the units a quarter of the face value', () => {
    const owed = distribute(FACE_VALUE_USD, [
      { ...WOODGROVE, units: 37_500 },
      { ...BRIDGELINE, units: 12_500 },
    ]);

    expect(owed[1].owed).to.equal(12_500n * USDC);
    expect(owed[1].sharePct).to.equal(25);
  });

  /*
   * The one rule the whole division stands on. A split that pays out more than was repaid would
   * be inventing money, and one that pays out less would strand it with nobody able to claim it.
   */
  it('hands out the face value exactly, whatever the units divide into', () => {
    const owed = distribute(FACE_VALUE_USD, [
      { ...WOODGROVE, units: 33_333 },
      { ...BRIDGELINE, units: 16_667 },
    ]);

    expect(total(owed)).to.equal(BigInt(FACE_VALUE_USD) * USDC);
  });

  /*
   * Three holders of a third each is the case that cannot divide evenly. The odd unit goes to
   * the largest holder rather than to whoever the loop happened to reach last.
   */
  it('gives a remainder that will not divide evenly to the largest holder', () => {
    const owed = distribute(1, [
      { name: 'Largest', wallet: '0xAAA', units: 2 },
      { name: 'Smaller', wallet: '0xBBB', units: 1 },
    ]);

    expect(total(owed)).to.equal(USDC);
    expect(owed[0].owed).to.be.greaterThan(owed[1].owed);
  });

  it('leaves out a wallet that holds nothing', () => {
    const owed = distribute(FACE_VALUE_USD, [
      { ...WOODGROVE, units: FACE_VALUE_USD },
      { ...BRIDGELINE, units: 0 },
    ]);

    expect(owed).to.have.length(1);
    expect(owed[0].wallet).to.equal(WOODGROVE.wallet);
  });

  /*
   * A receivable nobody holds is not a receivable owing everybody everything — it is one the
   * chain has no answer about yet, and dividing by nothing has to say so rather than throw.
   */
  it('owes nobody anything when nobody holds the receivable', () => {
    const owed = distribute(FACE_VALUE_USD, [
      { ...WOODGROVE, units: 0 },
      { ...BRIDGELINE, units: 0 },
    ]);

    expect(owed).to.have.length(0);
  });
});
