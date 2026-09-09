import { expect } from 'chai';
import { ethers } from 'ethers';

import { PROFILE_RECORDS, buildSetterBlob, decidePass, encodeName } from '../../src/ens';

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
      const blob = buildSetterBlob(name, 'rf.invoices.repaid');

      // The key travels inside the blob as plain text, which is what lets the
      // resolver scope the grant to this field rather than to the whole name.
      expect(blob).to.contain(ethers.hexlify(ethers.toUtf8Bytes('rf.invoices.repaid')).slice(2));
    });

    it('builds a different blob for a different field', () => {
      expect(buildSetterBlob(name, 'rf.invoices.repaid')).to.not.equal(
        buildSetterBlob(name, 'description'),
      );
    });

    it('builds the same blob for the same field every time', () => {
      expect(buildSetterBlob(name, 'rf.invoices.repaid')).to.equal(
        buildSetterBlob(name, 'rf.invoices.repaid'),
      );
    });
  });

  describe('PROFILE_RECORDS', () => {
    it('is exactly the three counts', () => {
      // Counts are published raw so the score is recomputable; a pre-computed grade would
      // make the platform the author of an opinion a funder has no reason to weight.
      expect(PROFILE_RECORDS).to.deep.equal([
        'rf.invoices.financed',
        'rf.invoices.repaid',
        'rf.invoices.defaulted',
      ]);
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
