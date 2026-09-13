import { expect } from 'chai';
import { dailyRatePct, feePct, priceFor } from '../src/pricing';

/** Ironline Freight's invoice, and the score its profile works out to today. */
const FACE_VALUE_USD = 50_000;
const MATURITY_DAYS = 60;
const SPOTLESS = 100;

describe('priceFor', () => {
  /*
   * Six invoices financed, six repaid, none defaulted — so Ironline scores 100 and earns the best
   * rate on offer: 0.05% a day, which over sixty days is a 3% fee.
   */
  it('prices a spotless $50,000 invoice at 60 days at exactly $48,500', () => {
    const quote = priceFor(FACE_VALUE_USD, MATURITY_DAYS, SPOTLESS);

    expect(quote.price).to.equal(48_500_000_000n);
    expect(quote.discount).to.equal(1_500_000_000n);
    expect(dailyRatePct(quote)).to.equal(0.05);
    expect(feePct(quote)).to.equal(3);
  });

  /*
   * The whole point of quoting a daily rate: the fee is that rate times the days the money is
   * out, and nothing else is in it. A business can check the arithmetic on the back of the
   * invoice, which is not true of an annual rate prorated over a 360-day year.
   */
  it('charges the daily rate once for every day the money is out', () => {
    for (const days of [30, 45, 60, 90]) {
      const quote = priceFor(FACE_VALUE_USD, days, 80);

      expect(feePct(quote)).to.equal(Number((dailyRatePct(quote) * days).toFixed(2)));
    }
  });

  it('gives the same price every time for the same face value, maturity and score', () => {
    const first = priceFor(FACE_VALUE_USD, MATURITY_DAYS, SPOTLESS);
    const second = priceFor(FACE_VALUE_USD, MATURITY_DAYS, SPOTLESS);

    expect(first.price).to.equal(second.price);
    expect(first.dailyRate).to.equal(second.dailyRate);
  });

  /*
   * One point of score has to move the price, or a business repays four invoices on time and
   * sees the same number. This is what the hundredths of a basis point are for.
   */
  it('moves the price for a single point of score', () => {
    const good = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 84);
    const better = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 85);

    expect(Number(better.discount)).to.be.lessThan(Number(good.discount));
  });

  /* The worst record on the scale pays three times the best one, and never more. */
  it('caps the fee at three times the best rate', () => {
    const best = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 100);
    const worst = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 0);

    expect(feePct(best)).to.equal(3);
    expect(feePct(worst)).to.equal(9);
  });

  it('charges a business with a better score a smaller discount', () => {
    const strong = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 90);
    const weak = priceFor(FACE_VALUE_USD, MATURITY_DAYS, 40);

    expect(Number(strong.discount)).to.be.lessThan(Number(weak.discount));
  });

  it('charges more for money that is tied up for longer', () => {
    const short = priceFor(FACE_VALUE_USD, 30, SPOTLESS);
    const long = priceFor(FACE_VALUE_USD, 90, SPOTLESS);

    expect(Number(long.discount)).to.be.greaterThan(Number(short.discount));
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
