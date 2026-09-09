import { expect } from 'chai';

import { creditScore } from '../../src/ens';

describe('creditScore', () => {
  describe('score', () => {
    it('scores a business that repaid every matured invoice at 100', () => {
      expect(creditScore({ financed: 6, repaid: 6, defaulted: 0 })).to.equal(100);
    });

    it('scores a business that repaid four of five matured invoices at 80', () => {
      expect(creditScore({ financed: 5, repaid: 4, defaulted: 1 })).to.equal(80);
    });

    it('rounds two of three matured invoices repaid to 67', () => {
      expect(creditScore({ financed: 3, repaid: 2, defaulted: 1 })).to.equal(67);
    });

    it('leaves the score unchanged when invoices are still outstanding', () => {
      // An invoice nobody has had to pay yet is neither a repayment nor a miss, so
      // financing more of them cannot move a business up or down.
      expect(creditScore({ financed: 12, repaid: 4, defaulted: 1 })).to.equal(
        creditScore({ financed: 5, repaid: 4, defaulted: 1 }),
      );
    });

    it('gives an identical answer to whoever computes it twice', () => {
      // The whole claim rests on this: two parties who disagree can each run the sum
      // and land on the same number without asking us.
      const counts = { financed: 9, repaid: 7, defaulted: 2 };

      expect(creditScore(counts)).to.equal(creditScore(counts));
    });

    it('leaves a business with nothing matured yet unrated', () => {
      expect(creditScore({ financed: 3, repaid: 0, defaulted: 0 })).to.equal(undefined);
    });

    it('scores a business that defaulted on everything at 0, which is not unrated', () => {
      // Unrated means nobody knows; 0 means everyone does. Collapsing the two would let
      // the worst record on the platform hide behind the same answer as a newcomer.
      expect(creditScore({ financed: 4, repaid: 0, defaulted: 4 })).to.equal(0);
    });
  });
});
