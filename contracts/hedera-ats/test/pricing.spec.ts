import { expect } from 'chai';
import { priceFor } from '../src/pricing';

/** Ironline Freight's invoice, and the score its profile works out to today. */
const FACE_VALUE_USD = 50_000;
const MATURITY_DAYS = 60;
const SPOTLESS = 100;

describe('priceFor', () => {
  /*
   * Six invoices financed, six repaid, none missed — so Ironline scores 100 and earns the best
   * rate on offer, which is the 5% over 60 days the whole demo is written around.
   */
  it('prices a spotless $50,000 invoice at 60 days at exactly $47,500', () => {
    const quote = priceFor(FACE_VALUE_USD, MATURITY_DAYS, SPOTLESS);

    expect(quote.price).to.equal(47_500_000_000n);
    expect(quote.discount).to.equal(2_500_000_000n);
  });

  it('gives the same price every time for the same face value, maturity and score', () => {
    const first = priceFor(FACE_VALUE_USD, MATURITY_DAYS, SPOTLESS);
    const second = priceFor(FACE_VALUE_USD, MATURITY_DAYS, SPOTLESS);

    expect(first.price).to.equal(second.price);
    expect(first.annualRateBps).to.equal(second.annualRateBps);
  });

  /*
   * A year is 360 days here, so an invoice payable in exactly a year is discounted by the
   * whole annual rate. This is the check that pins the day count down — every other price is
   * this one prorated.
   */
  it('discounts an invoice payable in a full year by the whole annual rate', () => {
    const quote = priceFor(FACE_VALUE_USD, 360, SPOTLESS);

    expect(quote.discount).to.equal((50_000_000_000n * BigInt(quote.annualRateBps)) / 10_000n);
  });

  it('charges a business with a better score a smaller discount', () => {
    const strong = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 90);
    const weak = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 40);

    expect(strong.discount).to.be.lessThan(weak.discount);
  });

  it('charges more for money that is tied up for longer', () => {
    const short = priceFor(FACE_VALUE_USD, 30, SPOTLESS);
    const long = priceFor(FACE_VALUE_USD, 90, SPOTLESS);

    expect(long.discount).to.be.greaterThan(short.discount);
  });

  /*
   * Being unrated is where every business starts, and reading it as a clean record is how a
   * platform ends up funding a stranger at its best rate.
   */
  it('prices a business with no record yet at the same rate as the worst score', () => {
    const unrated = priceFor(FACE_VALUE_USD, MATURITY_DAYS, null);
    const worst = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 0);

    expect(unrated.discount).to.equal(worst.discount);
  });

  it('reports an unrated business as unrated rather than as a score of nought', () => {
    expect(priceFor(FACE_VALUE_USD, MATURITY_DAYS, null).score).to.equal(null);
    expect(priceFor(FACE_VALUE_USD, MATURITY_DAYS, 0).score).to.equal(0);
  });

  it('treats a score beyond either end of the scale as that end of the scale', () => {
    const above = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 140);
    const below = priceFor(FACE_VALUE_USD, MATURITY_DAYS, -20);

    expect(above.discount).to.equal(priceFor(FACE_VALUE_USD, MATURITY_DAYS, 100).discount);
    expect(below.discount).to.equal(priceFor(FACE_VALUE_USD, MATURITY_DAYS, 0).discount);
  });
});
