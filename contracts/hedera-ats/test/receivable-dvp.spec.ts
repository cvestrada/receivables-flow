import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { Signer } from 'ethers';
import { deploySystemWithNewBlr } from '@hashgraph/asset-tokenization-contracts/scripts';
import { IAllowance__factory, IBalanceTracker__factory } from '@hashgraph/asset-tokenization-contracts';
import { MockUsdc__factory, ReceivableDvp__factory } from '../typechain-types';
import type { MockUsdc, ReceivableDvp } from '../typechain-types';
import {
  approveHolder,
  issueReceivableToken,
  mintTo,
  type AtsDeployment,
  type Invoice,
} from '../src/receivable-token';

const ACME_INVOICE: Invoice = {
  reference: 'Acme Invoice #1042',
  code: 'RF1042',
  faceValueUsd: 50_000,
  maturityDays: 60,
};

/** The whole invoice is sold in one lot: 50,000 units, one per dollar of face value. */
const UNITS = 50_000n;

/** $47,500 in USDC's six decimals — the $50,000 invoice bought at a discount. */
const PRICE = 47_500_000_000n;

describe('ReceivableDvp', () => {
  let ats: AtsDeployment;
  let issuer: Signer;
  let investor: Signer;
  let stranger: Signer;
  let issuerAddress: string;
  let investorAddress: string;
  let strangerAddress: string;

  let dvp: ReceivableDvp;
  let usdc: MockUsdc;
  let token: string;

  /*
   * The ATS facets are shared implementation, not per-token state, so the system is deployed
   * once for the file. Every test still opens its own offer against a freshly issued token.
   */
  before(async function () {
    this.timeout(600_000);
    [issuer, investor, stranger] = await ethers.getSigners();
    [issuerAddress, investorAddress, strangerAddress] = await Promise.all([
      issuer.getAddress(),
      investor.getAddress(),
      stranger.getAddress(),
    ]);

    const deployment = await deploySystemWithNewBlr(issuer, 'hardhat', {
      useTimeTravel: false,
      saveOutput: false,
      deployOnlyBondConfig: true,
      verifyDeployment: false,
    });

    ats = {
      factory: deployment.infrastructure.factory.proxy,
      resolver: deployment.infrastructure.blr.proxy,
    };
  });

  beforeEach(async function () {
    this.timeout(180_000);

    dvp = await new ReceivableDvp__factory(issuer).deploy();
    usdc = await new MockUsdc__factory(issuer).deploy();

    token = await issueReceivableToken(issuer, ats, ACME_INVOICE, [issuerAddress]);
    await mintTo(issuer, token, issuerAddress, Number(UNITS));

    /*
     * ATS refuses to grant an allowance to an address that is not on the approved list, so the
     * settlement contract is listed before the seller can authorise it. It is listed as a
     * spender only — it pulls the units straight through to the buyer and never holds a balance.
     */
    await approveHolder(issuer, token, await dvp.getAddress());
    await IAllowance__factory.connect(token, issuer).approve(await dvp.getAddress(), UNITS);
  });

  /** Puts the whole invoice on offer and returns its id. */
  async function openOffer(): Promise<bigint> {
    const id = await dvp.connect(issuer).offer.staticCall(token, UNITS, await usdc.getAddress(), PRICE);
    await dvp.connect(issuer).offer(token, UNITS, await usdc.getAddress(), PRICE);
    return id;
  }

  /** Funds a buyer with USDC and authorises the payment leg. */
  async function fundBuyer(buyer: Signer, amount = PRICE): Promise<void> {
    await usdc.mint(await buyer.getAddress(), amount);
    await usdc.connect(buyer).approve(await dvp.getAddress(), amount);
  }

  describe('settle', () => {
    it('moves the payment and the units together for an approved investor', async () => {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor);
      const id = await openOffer();

      await dvp.connect(investor).settle(id);

      const balances = IBalanceTracker__factory.connect(token, issuer);
      expect(await balances.balanceOf(investorAddress)).to.equal(UNITS);
      expect(await usdc.balanceOf(issuerAddress)).to.equal(PRICE);
      expect(await usdc.balanceOf(investorAddress)).to.equal(0n);
    });

    /*
     * The whole reason this contract exists. The security refuses the unapproved buyer, and
     * because both legs share one transaction that refusal takes the payment back with it —
     * the buyer cannot end up out of pocket holding nothing.
     */
    it('leaves the payment where it was when the buyer is not an approved holder', async () => {
      await fundBuyer(stranger);
      const id = await openOffer();

      await expect(dvp.connect(stranger).settle(id)).to.be.reverted;

      const balances = IBalanceTracker__factory.connect(token, issuer);
      expect(await balances.balanceOf(strangerAddress)).to.equal(0n);
      expect(await usdc.balanceOf(strangerAddress)).to.equal(PRICE);
      expect(await usdc.balanceOf(issuerAddress)).to.equal(0n);
    });

    it('leaves the units where they were when the buyer cannot pay', async () => {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor, PRICE - 1n);
      const id = await openOffer();

      await expect(dvp.connect(investor).settle(id)).to.be.reverted;

      const balances = IBalanceTracker__factory.connect(token, issuer);
      expect(await balances.balanceOf(investorAddress)).to.equal(0n);
      expect(await balances.balanceOf(issuerAddress)).to.equal(UNITS);
    });

    it('refuses a second settlement of the same offer', async () => {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor, PRICE * 2n);
      const id = await openOffer();

      await dvp.connect(investor).settle(id);

      await expect(dvp.connect(investor).settle(id)).to.be.revertedWithCustomError(dvp, 'NotOpen');
    });
  });

  describe('cancel', () => {
    it('closes the offer so it can no longer be settled', async () => {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor);
      const id = await openOffer();

      await dvp.connect(issuer).cancel(id);

      await expect(dvp.connect(investor).settle(id)).to.be.revertedWithCustomError(dvp, 'NotOpen');
    });

    it('refuses anyone but the seller', async () => {
      const id = await openOffer();

      await expect(dvp.connect(investor).cancel(id)).to.be.revertedWithCustomError(dvp, 'NotSeller');
      expect((await dvp.offerOf(id)).open).to.equal(true);
    });
  });
});
