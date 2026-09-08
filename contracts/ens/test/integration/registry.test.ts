import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers as hre } from 'hardhat';
import { ethers } from 'ethers';

import {
  ABI,
  PASS_WALLET_RECORD,
  PROFILE_RECORDS,
  RATING_RECORD,
  ROLES,
  appointReviewer,
  buildSetterBlob,
  givePage,
  issuePass,
  openBranch,
  openRegistry,
  readPass,
  readRecord,
  revokePass,
  revokeReviewer,
  writeRecords,
} from '../../src/ens';

/*
 * These run against a fork of Sepolia, so the ENSv2 contracts are the deployed ones rather
 * than mocks. A mock would assert our own guess about who is allowed to write what, which is
 * the single thing worth checking here.
 */
describe('registry', () => {
  /*
   * A fresh label per run, because the fork follows the head of Sepolia and the platform's real
   * name is registered there. Reusing `receivablesflow` would make every test resolve against
   * whatever the live deployment currently holds instead of the state the fixture just built.
   */
  const BASE_LABEL = `rf${Date.now().toString(36)}`;
  const COUNTS = {
    'rf.invoices.financed': '6',
    'rf.invoices.repaid': '6',
    'rf.invoices.defaulted': '0',
  };

  async function onboarded() {
    const [platform, business, reviewer, stranger, otherBusiness] = await hre.getSigners();

    const opened = await openRegistry(platform as never, BASE_LABEL);
    const { baseName, registry } = opened;
    const { name, resolver } = await givePage(platform as never, opened, 'ironline');

    await writeRecords(platform as never, resolver, name, COUNTS);
    await appointReviewer(platform as never, resolver, name, await reviewer.getAddress());

    return { platform, business, reviewer, stranger, otherBusiness, opened, baseName, registry, resolver, name };
  }

  const asReviewer = (resolver: string, signer: ethers.Signer) =>
    new ethers.Contract(resolver, ABI.resolver, signer);

  describe('standing up the registry', () => {
    it('leaves the platform owning its public name', async () => {
      const { platform, baseName } = await loadFixture(onboarded);
      const ethRegistry = new ethers.Contract(
        '0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e',
        ABI.registry,
        hre.provider as never,
      );
      expect(await ethRegistry.findOwner(baseName.replace('.eth', ''))).to.equal(
        await platform.getAddress(),
      );
    });

    it('puts the platform-owned registry beneath that name', async () => {
      const { registry, baseName } = await loadFixture(onboarded);
      const ethRegistry = new ethers.Contract(
        '0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e',
        ABI.registry,
        hre.provider as never,
      );

      expect(await ethRegistry.getSubregistry(baseName.replace('.eth', ''))).to.equal(registry);
    });

    it('does not open a second registry when run again', async () => {
      const { platform, registry } = await loadFixture(onboarded);

      expect((await openRegistry(platform as never, BASE_LABEL)).registry).to.equal(registry);
    });
  });

  describe('giving a company its page', () => {
    it('leaves the platform as owner, never the company', async () => {
      const { platform, business, registry } = await loadFixture(onboarded);
      const ourRegistry = new ethers.Contract(registry, ABI.registry, hre.provider as never);
      expect(await ourRegistry.findOwner('ironline')).to.equal(await platform.getAddress());
      expect(await ourRegistry.findOwner('ironline')).to.not.equal(await business.getAddress());
    });

    it('does not issue a second name when run again', async () => {
      const { platform, registry, opened } = await loadFixture(onboarded);
      const ourRegistry = new ethers.Contract(registry, ABI.registry, hre.provider as never);
      const before = await ourRegistry.findTokenId('ironline');

      await givePage(platform as never, opened, 'ironline');
      const after = await ourRegistry.findTokenId('ironline');

      expect(after).to.equal(before);
    });
  });

  describe('writing the record', () => {
    it('reads the counts back exactly as written', async () => {
      const { resolver, name } = await loadFixture(onboarded);

      for (const [key, value] of Object.entries(COUNTS)) {
        expect(await readRecord(hre.provider as never, resolver, name, key)).to.equal(value);
      }
    });

    it('publishes raw counts and no combined score', async () => {
      const { resolver, name } = await loadFixture(onboarded);

      // A score field would make the platform the author of an opinion; the counts are
      // observations anyone can recompute from.
      expect(await readRecord(hre.provider as never, resolver, name, 'rf.score')).to.equal('');
      expect(PROFILE_RECORDS).to.have.lengthOf(4);
    });

    it('replaces a count rather than appending to it', async () => {
      const { platform, resolver, name } = await loadFixture(onboarded);

      await writeRecords(platform as never, resolver, name, { 'rf.invoices.repaid': '7' });

      expect(await readRecord(hre.provider as never, resolver, name, 'rf.invoices.repaid')).to.equal('7');
    });
  });

  describe('the reviewer role', () => {
    it('lets the appointed reviewer set the rating', async () => {
      const { reviewer, resolver, name } = await loadFixture(onboarded);

      await asReviewer(resolver, reviewer as never).setText(
        (await import('../../src/ens')).encodeName(name),
        RATING_RECORD,
        'B',
      );

      expect(await readRecord(hre.provider as never, resolver, name, RATING_RECORD)).to.equal('B');
    });

    it('refuses the reviewer on any other field', async () => {
      const { reviewer, resolver, name } = await loadFixture(onboarded);
      const { encodeName } = await import('../../src/ens');

      await expect(
        asReviewer(resolver, reviewer as never).setText(encodeName(name), 'description', 'hijacked'),
      ).to.be.reverted;
    });

    it('refuses the business on its own rating — the demo moment', async () => {
      const { business, resolver, name } = await loadFixture(onboarded);
      const { encodeName } = await import('../../src/ens');

      await expect(
        asReviewer(resolver, business as never).setText(encodeName(name), RATING_RECORD, 'AAA'),
      ).to.be.reverted;
    });

    it('refuses the business on every other field too', async () => {
      const { business, resolver, name } = await loadFixture(onboarded);
      const { encodeName } = await import('../../src/ens');

      await expect(
        asReviewer(resolver, business as never).setText(encodeName(name), 'rf.invoices.repaid', '99'),
      ).to.be.reverted;
    });

    it('refuses a stranger who was never appointed', async () => {
      const { stranger, resolver, name } = await loadFixture(onboarded);
      const { encodeName } = await import('../../src/ens');

      await expect(
        asReviewer(resolver, stranger as never).setText(encodeName(name), RATING_RECORD, 'AAA'),
      ).to.be.reverted;
    });

    it('lets the platform take the rating back', async () => {
      const { platform, reviewer, resolver, name } = await loadFixture(onboarded);
      const { encodeName } = await import('../../src/ens');

      await revokeReviewer(platform as never, resolver, name, await reviewer.getAddress());

      await expect(
        asReviewer(resolver, reviewer as never).setText(encodeName(name), RATING_RECORD, 'B'),
      ).to.be.reverted;
    });

    it('scopes an appointment to one company, not to every company', async () => {
      const { platform, reviewer, resolver, opened } = await loadFixture(onboarded);
      const { encodeName } = await import('../../src/ens');

      const other = await givePage(platform as never, opened, 'woodgrove');

      await expect(
        asReviewer(other.resolver, reviewer as never).setText(
          encodeName(other.name),
          RATING_RECORD,
          'AAA',
        ),
      ).to.be.reverted;
    });

    it('grants the text-setter role and nothing wider', async () => {
      const { reviewer, resolver, name } = await loadFixture(onboarded);
      const contract = new ethers.Contract(resolver, ABI.resolver, hre.provider as never);
      const [, resource, roleBitmap] = await contract.decodeSetter(
        buildSetterBlob(name, RATING_RECORD),
      );

      expect(roleBitmap).to.equal(ROLES.setText);
      expect(await contract.hasRoles(resource, ROLES.setText, await reviewer.getAddress())).to.equal(true);
    });
  });

  describe('the investor approval pass', () => {
    const PASS_DAYS = 30;
    const PASS_SECONDS = PASS_DAYS * 24 * 60 * 60;

    async function cleared() {
      const base = await loadFixture(onboarded);
      const [, , , , , investor] = await hre.getSigners();
      const wallet = await investor.getAddress();
      const investors = await openBranch(base.platform as never, base.opened, 'investor');
      const pass = await issuePass(
        base.platform as never,
        investors,
        'woodgrove',
        wallet,
        PASS_SECONDS,
      );

      return { ...base, investor, wallet, investors, pass };
    }

    describe('opening the two sides of the market', () => {
      it('puts the fund under the investor side, not beside the businesses', async () => {
        const { pass } = await cleared();

        expect(pass.name).to.equal(`woodgrove.investor.${BASE_LABEL}.eth`);
      });

      it('gives the investor side a registry of its own beneath the platform name', async () => {
        const { registry, investors } = await cleared();
        const ourRegistry = new ethers.Contract(registry, ABI.registry, hre.provider as never);

        expect(await ourRegistry.getSubregistry('investor')).to.equal(investors.registry);
      });

      it('does not open a second registry for a side already open', async () => {
        const { platform, opened, investors } = await cleared();

        expect((await openBranch(platform as never, opened, 'investor')).registry).to.equal(
          investors.registry,
        );
      });
    });

    describe('issuing the pass', () => {
      it('gives the fund a name in the investor registry', async () => {
        const { investors, pass } = await cleared();
        const ourRegistry = new ethers.Contract(investors.registry, ABI.registry, hre.provider as never);

        expect(pass.resolver).to.not.equal(ethers.ZeroAddress);
        expect(await ourRegistry.getResolver('woodgrove')).to.equal(pass.resolver);
      });

      it('leaves the platform as owner, so the fund cannot hand its clearance on', async () => {
        const { platform, investor, investors } = await cleared();
        const ourRegistry = new ethers.Contract(investors.registry, ABI.registry, hre.provider as never);

        expect(await ourRegistry.findOwner('woodgrove')).to.equal(await platform.getAddress());
        expect(await ourRegistry.findOwner('woodgrove')).to.not.equal(await investor.getAddress());
      });

      it('carries the expiry it was issued with', async () => {
        const { investors, pass } = await cleared();
        const ourRegistry = new ethers.Contract(investors.registry, ABI.registry, hre.provider as never);

        expect(await ourRegistry.findExpiry('woodgrove')).to.equal(pass.expiresAt);
        expect(pass.expiresAt).to.be.greaterThan(BigInt(await time.latest()));
      });

      it('records the wallet the pass clears', async () => {
        const { pass, wallet } = await cleared();

        expect(
          await readRecord(hre.provider as never, pass.resolver, pass.name, PASS_WALLET_RECORD),
        ).to.equal(wallet);
      });

      it('does not issue a second name when run again', async () => {
        const { platform, investors, wallet, pass } = await cleared();

        const again = await issuePass(platform as never, investors, 'woodgrove', wallet, PASS_SECONDS);

        expect(again.resolver).to.equal(pass.resolver);
        expect(again.expiresAt).to.equal(pass.expiresAt);
        expect(again.wallet).to.equal(pass.wallet);
      });
    });

    describe('reading the pass', () => {
      it('answers cleared to a stranger holding only the name', async () => {
        const { investors, wallet } = await cleared();

        // No platform signer anywhere in this path — a plain provider is the whole of it.
        const answer = await readPass(hre.provider as never, investors, 'woodgrove');

        expect(answer.cleared).to.equal(true);
        expect(answer.wallet).to.equal(wallet);
      });

      it('stops answering cleared once the chain clock passes the expiry', async () => {
        const { investors } = await cleared();

        await time.increase(PASS_SECONDS + 1);

        expect((await readPass(hre.provider as never, investors, 'woodgrove')).cleared).to.equal(false);
      });
    });

    describe('taking the pass back', () => {
      it('lets the platform revoke a pass whose expiry is still ahead', async () => {
        const { platform, investors } = await cleared();

        await revokePass(platform as never, investors, 'woodgrove');
        const answer = await readPass(hre.provider as never, investors, 'woodgrove');

        expect(answer.cleared).to.equal(false);
        expect(answer.expiresAt).to.be.greaterThan(BigInt(await time.latest()));
      });

      it('refuses the fund on its own pass', async () => {
        const { investor, investors } = await cleared();

        await expect(revokePass(investor as never, investors, 'woodgrove')).to.be.reverted;
      });
    });
  });
});
