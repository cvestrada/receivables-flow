import { expect } from 'chai';

import { creditScore } from '../../src/ens';

describe('creditScore', () => {
  describe('score', () => {
    it('scores a business that paid every matured invoice on time at 100', () => {
      expect(creditScore({ financed: 6, ontime: 6, late: 0, defaulted: 0 })).to.equal(100);
    });

    it('scores a business that paid four of five matured invoices, one missed, at 80', () => {
      expect(creditScore({ financed: 5, ontime: 4, late: 0, defaulted: 1 })).to.equal(80);
    });

    it('rounds two on time and one missed of three matured to 67', () => {
      expect(creditScore({ financed: 3, ontime: 2, late: 0, defaulted: 1 })).to.equal(67);
    });

    it('scores a late payment above a default and below an on-time one', () => {
      // Paying fifteen days after the date the investor bought is not the same as never
      // paying, and it is not the same as paying. The score has to be able to say all three.
      const late = creditScore({ financed: 3, ontime: 2, late: 1, defaulted: 0 });
      const paid = creditScore({ financed: 3, ontime: 3, late: 0, defaulted: 0 });
      const missed = creditScore({ financed: 3, ontime: 2, late: 0, defaulted: 1 });

      expect(late).to.be.lessThan(paid as number);
      expect(late).to.be.greaterThan(missed as number);
    });

    it('drops a spotless business to 93 when one invoice is paid late', () => {
      // The number the resale is priced off once Ironline's seventh invoice comes in late.
      expect(creditScore({ financed: 7, ontime: 6, late: 1, defaulted: 0 })).to.equal(93);
    });

    it('scores a business that paid everything, but always late, at 50', () => {
      expect(creditScore({ financed: 4, ontime: 0, late: 4, defaulted: 0 })).to.equal(50);
    });

    it('leaves the score unchanged when invoices are still outstanding', () => {
      // An invoice nobody has had to pay yet is neither a payment nor a miss, so
      // financing more of them cannot move a business up or down.
      expect(creditScore({ financed: 12, ontime: 4, late: 0, defaulted: 1 })).to.equal(
        creditScore({ financed: 5, ontime: 4, late: 0, defaulted: 1 }),
      );
    });

    it('gives an identical answer to whoever computes it twice', () => {
      // The whole claim rests on this: two parties who disagree can each run the sum
      // and land on the same number without asking us.
      const counts = { financed: 9, ontime: 6, late: 1, defaulted: 2 };

      expect(creditScore(counts)).to.equal(creditScore(counts));
    });

    it('leaves a business with nothing matured yet unrated', () => {
      expect(creditScore({ financed: 3, ontime: 0, late: 0, defaulted: 0 })).to.equal(undefined);
    });

    it('scores a business that defaulted on everything at 0, which is not unrated', () => {
      // Unrated means nobody knows; 0 means everyone does. Collapsing the two would let
      // the worst record on the platform hide behind the same answer as a newcomer.
      expect(creditScore({ financed: 4, ontime: 0, late: 0, defaulted: 4 })).to.equal(0);
    });
  });
});
