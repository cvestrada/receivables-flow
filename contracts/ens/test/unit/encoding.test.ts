import { expect } from 'chai';
import { ethers } from 'ethers';

import {
  ONBOARD_COUNTS,
  PROFILE_RECORDS,
  SETTLEMENT_RECORD,
  WRITABLE_RECORDS,
  applyOutcome,
  buildSetterBlob,
  countRecords,
  creditScore,
  decidePass,
  encodeName,
} from '../../src/ens';

describe('encoding', () => {
  describe('encodeName', () => {
    it('writes each label with its own length and terminates with a zero byte', () => {
      const encoded = encodeName('ironline.receivablesflow.eth');

      expect(encoded).to.equal(
        ethers.hexlify(
          ethers.concat([
            new Uint8Array([8]),
            ethers.toUtf8Bytes('ironline'),
            new Uint8Array([15]),
            ethers.toUtf8Bytes('receivablesflow'),
            new Uint8Array([3]),
            ethers.toUtf8Bytes('eth'),
            new Uint8Array([0]),
          ]),
        ),
      );
    });
  });

  describe('buildSetterBlob', () => {
    const name = 'ironline.receivablesflow.eth';

    it('carries the field it scopes to', () => {
      const blob = buildSetterBlob(name, 'rf.invoices.ontime');

      // The key travels inside the blob as plain text, which is what lets the
      // resolver scope the grant to this field rather than to the whole name.
      expect(blob).to.contain(ethers.hexlify(ethers.toUtf8Bytes('rf.invoices.ontime')).slice(2));
    });

    it('builds a different blob for a different field', () => {
      expect(buildSetterBlob(name, 'rf.invoices.ontime')).to.not.equal(
        buildSetterBlob(name, 'description'),
      );
    });

    it('builds the same blob for the same field every time', () => {
      expect(buildSetterBlob(name, 'rf.invoices.ontime')).to.equal(
        buildSetterBlob(name, 'rf.invoices.ontime'),
      );
    });
  });

  describe('PROFILE_RECORDS', () => {
    it('is the four counts, and the one that makes them add up', () => {
      // Counts are published raw so the score is recomputable; a pre-computed grade would
      // make the platform the author of an opinion a funder has no reason to weight.
      // `outstanding` is derived, and published anyway: read raw off the page, "9 financed,
      // 6 on time, 2 late" looked like a sum that failed until the 1 still due sat beside it.
      expect(PROFILE_RECORDS).to.deep.equal([
        'rf.invoices.financed',
        'rf.invoices.ontime',
        'rf.invoices.late',
        'rf.invoices.defaulted',
        'rf.invoices.outstanding',
      ]);
    });

    it('publishes outstanding as financed minus matured, so the page always adds up', () => {
      const records = countRecords({ financed: 9, ontime: 6, late: 2, defaulted: 0 });

      expect(records['rf.invoices.outstanding']).to.equal('1');
    });

    it('refuses to publish counts that describe an impossible business', () => {
      expect(() => countRecords({ financed: 6, ontime: 6, late: 2, defaulted: 0 })).to.throw(
        /impossible record/,
      );
    });
  });

  describe('applyOutcome', () => {
    /** The record with the demo's invoice sold and not yet due — the state day 60 acts on. */
    const ONE_OUTSTANDING = { ...ONBOARD_COUNTS, financed: ONBOARD_COUNTS.financed + 1 };

    it('adds one invoice paid on time, and a business that scored 83 now scores 86', () => {
      const after = applyOutcome(ONE_OUTSTANDING, 'repaid');

      expect(creditScore(ONE_OUTSTANDING)).to.equal(83);
      expect(after.ontime).to.equal(ONBOARD_COUNTS.ontime + 1);
      expect(creditScore(after)).to.equal(86);
    });

    it('adds one invoice never paid, and a business that scored 83 now scores 71', () => {
      const after = applyOutcome(ONE_OUTSTANDING, 'defaulted');

      expect(after.defaulted).to.equal(ONBOARD_COUNTS.defaulted + 1);
      expect(creditScore(after)).to.equal(71);
    });

    it('leaves how many invoices the business has sold alone, whichever way day 60 ends', () => {
      // The invoice was counted as financed when it was sold. Counting it again at maturity
      // would say the business raised money twice on one invoice.
      for (const ending of ['repaid', 'defaulted'] as const) {
        expect(applyOutcome(ONE_OUTSTANDING, ending).financed).to.equal(ONE_OUTSTANDING.financed);
      }
    });

    it('refuses an ending when nothing is outstanding', () => {
      // Onboarding leaves six financed and six matured. An ending needs an invoice to end, and
      // a page that said "6 sold, 7 repaid" would be a record of a business that cannot exist.
      for (const ending of ['repaid', 'defaulted'] as const) {
        expect(() => applyOutcome(ONBOARD_COUNTS, ending)).to.throw(/nothing outstanding/);
      }
    });

    it('scores a business for the first time on its first ending', () => {
      const newcomer = { financed: 1, ontime: 0, late: 0, defaulted: 0 };

      // Unrated is not a score of nought — it is the absence of one. The first invoice to
      // mature is what turns a business that nobody has lent to into one with a record.
      expect(creditScore(newcomer)).to.equal(undefined);
      expect(creditScore(applyOutcome(newcomer, 'repaid'))).to.equal(100);
    });

    it('moves the record again each time it is applied, while something is outstanding', () => {
      // Whether an ending has already been recorded is the caller's question, not this
      // function's — it answers what one more ending does to a record with invoices still due.
      const two = { ...ONBOARD_COUNTS, financed: ONBOARD_COUNTS.financed + 2 };
      const twice = applyOutcome(applyOutcome(two, 'repaid'), 'repaid');

      expect(twice.ontime).to.equal(ONBOARD_COUNTS.ontime + 2);
    });
  });

  describe('ONBOARD_COUNTS', () => {
    it('scores 83 — neither perfect nor unrated, so an ending can move it either way', () => {
      // A business onboarded at 100 has nowhere to go: repaying leaves the price exactly
      // where it was, and the whole claim of a public record is that paying is worth
      // something. Starting a little below the top is what makes both directions visible.
      expect(creditScore(ONBOARD_COUNTS)).to.equal(83);
    });

    it('has been slow twice and has never walked away from an invoice', () => {
      // The demo business has to be fundable. Two late payments read as a company under
      // pressure; a default reads as one an investor should decline, which would make every
      // screen after this one an argument with the record behind it.
      expect(ONBOARD_COUNTS.late).to.equal(2);
      expect(ONBOARD_COUNTS.defaulted).to.equal(0);
    });

    it('names every count the page publishes', () => {
      // A page seeded with three of its four counts reads as a business with a missing
      // record rather than one with a record of nought.
      expect(Object.keys(countRecords(ONBOARD_COUNTS))).to.deep.equal([...PROFILE_RECORDS]);
    });
  });

  describe('SETTLEMENT_RECORD', () => {
    it('is a record the platform is granted, so a page issued before it existed gets it', () => {
      // Grants are topped up on every onboard run. A record left off this list would be
      // published by no page that already exists — only by pages issued after today.
      expect(WRITABLE_RECORDS).to.include(SETTLEMENT_RECORD);
    });

    it('scopes its write permission to itself and not to the counts beside it', () => {
      const name = 'ironline.receivablesflow.eth';

      expect(buildSetterBlob(name, SETTLEMENT_RECORD)).to.not.equal(
        buildSetterBlob(name, 'rf.invoices.ontime'),
      );
    });
  });

  describe('decidePass', () => {
    const WALLET = '0x1111111111111111111111111111111111111111';
    const DAY = 86_400n;
    const EXPIRES = 1_800_000_000n;

    it('clears a fund while its expiry is still ahead', () => {
      expect(decidePass(WALLET, EXPIRES, EXPIRES - DAY).cleared).to.equal(true);
    });

    it('stops clearing the fund once the expiry has passed', () => {
      // Nobody acts for this to happen. That is the whole point of putting a date on the
      // pass rather than a flag someone has to remember to turn off.
      expect(decidePass(WALLET, EXPIRES, EXPIRES + DAY).cleared).to.equal(false);
    });

    it('does not clear the fund at the exact second it expires', () => {
      expect(decidePass(WALLET, EXPIRES, EXPIRES).cleared).to.equal(false);
    });

    it('does not clear a fund that was never issued a pass', () => {
      expect(decidePass('', 0n, EXPIRES - DAY).cleared).to.equal(false);
    });

    it('reports the expiry the answer was decided on', () => {
      // A caller that has to show its working needs the date, not just the verdict.
      expect(decidePass(WALLET, EXPIRES, EXPIRES - DAY).expiresAt).to.equal(EXPIRES);
    });
  });
});
