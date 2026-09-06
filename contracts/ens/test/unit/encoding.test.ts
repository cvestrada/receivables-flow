import { expect } from 'chai';
import { ethers } from 'ethers';

import { PROFILE_RECORDS, buildSetterBlob, encodeName } from '../../src/ens';

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
      const blob = buildSetterBlob(name, 'credit.rating');

      // The key travels inside the blob as plain text, which is what lets the
      // resolver scope the grant to this field rather than to the whole name.
      expect(blob).to.contain(ethers.hexlify(ethers.toUtf8Bytes('credit.rating')).slice(2));
    });

    it('builds a different blob for a different field', () => {
      expect(buildSetterBlob(name, 'credit.rating')).to.not.equal(
        buildSetterBlob(name, 'description'),
      );
    });

    it('builds the same blob for the same field every time', () => {
      expect(buildSetterBlob(name, 'credit.rating')).to.equal(
        buildSetterBlob(name, 'credit.rating'),
      );
    });
  });

  describe('PROFILE_RECORDS', () => {
    it('is exactly the three counts and the rating', () => {
      // Counts are published raw so any score is recomputable; a fourth count or a
      // pre-computed grade would make the platform the author of an opinion.
      expect(PROFILE_RECORDS).to.deep.equal([
        'rf.invoices.financed',
        'rf.invoices.repaid',
        'rf.invoices.defaulted',
        'credit.rating',
      ]);
    });
  });
});
