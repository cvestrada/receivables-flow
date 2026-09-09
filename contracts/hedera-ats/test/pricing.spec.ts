import { expect } from 'chai';
import { priceFor } from '../src/pricing';

/** Ironline Freight's invoice, and the rating its profile carries today. */
const FACE_VALUE_USD = 50_000;
const MATURITY_DAYS = 60;
const RATING = 'B';

describe('priceFor', () => {
  it('prices a B-rated $50,000 invoice at 60 days at exactly $47,500', () => {
    const quote = priceFor(FACE_VALUE_USD, MATURITY_DAYS, RATING);

    expect(quote.price).to.equal(47_500_000_000n);
    expect(quote.discount).to.equal(2_500_000_000n);
  });

  it('gives the same price every time for the same face value, maturity and rating', () => {
    const first = priceFor(FACE_VALUE_USD, MATURITY_DAYS, RATING);
    const second = priceFor(FACE_VALUE_USD, MATURITY_DAYS, RATING);

    expect(first.price).to.equal(second.price);
    expect(first.annualRateBps).to.equal(second.annualRateBps);
  });

  /*
   * A year is 360 days here, so an invoice payable in exactly a year is discounted by the
   * whole annual rate. This is the check that pins the day count down — every other price is
   * this one prorated.
   */
  it('discounts an invoice payable in a full year by the whole annual rate', () => {
    const quote = priceFor(FACE_VALUE_USD, 360, RATING);

    expect(quote.discount).to.equal((50_000_000_000n * BigInt(quote.annualRateBps)) / 10_000n);
  });

  it('charges a better-rated business a smaller discount', () => {
    const strong = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 'AA');
    const weak = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 'B');

    expect(strong.discount).to.be.lessThan(weak.discount);
  });

  it('charges more for money that is tied up for longer', () => {
    const short = priceFor(FACE_VALUE_USD, 30, RATING);
    const long = priceFor(FACE_VALUE_USD, 90, RATING);

    expect(long.discount).to.be.greaterThan(short.discount);
  });

  /*
   * An empty profile is the state every business starts in, and reading it as spotless is how
   * a platform ends up funding a stranger at its best rate.
   */
  it('prices a business with no published rating no better than the lowest grade', () => {
    const unrated = priceFor(FACE_VALUE_USD, MATURITY_DAYS, '');
    const worst = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 'CCC');

    expect(unrated.discount).to.equal(worst.discount);
  });

  it('prices a rating nobody recognises no better than the lowest grade', () => {
    const nonsense = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 'ZZZ');
    const worst = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 'CCC');

    expect(nonsense.discount).to.equal(worst.discount);
  });
});
