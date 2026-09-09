import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { Signer } from 'ethers';
import { deploySystemWithNewBlr } from '@hashgraph/asset-tokenization-contracts/scripts';
import { IAllowance__factory, IBalanceTracker__factory } from '@hashgraph/asset-tokenization-contracts';
import { MockUsdc__factory, ReceivableDvp__factory } from '../typechain-types';
import type { MockScheduleService, MockUsdc, ReceivableDvp } from '../typechain-types';
import { installScheduleService } from './schedule-service';
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

const SECONDS_PER_DAY = 86_400n;

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
  let schedule: MockScheduleService;

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

    schedule = await installScheduleService(issuer);

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
    const payment = await usdc.getAddress();
    const terms = [token, UNITS, payment, PRICE, ACME_INVOICE.maturityDays] as const;

    const id = await dvp.connect(issuer).offer.staticCall(...terms);
    await dvp.connect(issuer).offer(...terms);
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

    it('leaves a booked schedule on the offer once the sale has settled', async () => {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor);
      const id = await openOffer();

      await dvp.connect(investor).settle(id);

      expect(await schedule.bookings()).to.equal(1n);
      expect((await dvp.offerOf(id)).schedule).to.not.equal(ethers.ZeroAddress);
    });

    it('books the payment for the invoice maturity measured from when the sale settled', async () => {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor);
      const id = await openOffer();

      const receipt = await (await dvp.connect(investor).settle(id)).wait();
      const settledAt = BigInt((await ethers.provider.getBlock(receipt!.blockNumber))!.timestamp);

      const expected = settledAt + BigInt(ACME_INVOICE.maturityDays) * SECONDS_PER_DAY;
      expect((await schedule.booking()).expirySecond).to.equal(expected);
      expect((await dvp.offerOf(id)).maturesAt).to.equal(expected);
    });

    /*
     * The booked call carries the offer's own id. Without that a callback meant for one
     * receivable could mature another, which is the whole risk of scheduling work in advance.
     */
    it('books a call that names the receivable it will mature', async () => {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor);
      const id = await openOffer();

      await dvp.connect(investor).settle(id);

      const booked = await schedule.booking();
      expect(booked.to).to.equal(await dvp.getAddress());
      expect(booked.callData).to.equal(dvp.interface.encodeFunctionData('mature', [id]));
    });

    it('reverts the whole sale when the network refuses the booking', async () => {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor);
      const id = await openOffer();
      await schedule.setRefusing(true);

      await expect(dvp.connect(investor).settle(id)).to.be.revertedWithCustomError(dvp, 'BookingRefused');

      const balances = IBalanceTracker__factory.connect(token, issuer);
      expect(await usdc.balanceOf(investorAddress)).to.equal(PRICE);
      expect(await usdc.balanceOf(issuerAddress)).to.equal(0n);
      expect(await balances.balanceOf(issuerAddress)).to.equal(UNITS);
      expect(await balances.balanceOf(investorAddress)).to.equal(0n);
    });
  });

  describe('mature', () => {
    /** Settles the sale and hands back the offer whose payment is now booked. */
    async function settledOffer(): Promise<bigint> {
      await approveHolder(issuer, token, investorAddress);
      await fundBuyer(investor);
      const id = await openOffer();
      await dvp.connect(investor).settle(id);
      return id;
    }

    it('marks the receivable matured when the scheduled call arrives', async () => {
      const id = await settledOffer();

      await schedule.fire();

      expect((await dvp.offerOf(id)).matured).to.equal(true);
    });

    it('refuses an ordinary account calling it directly', async () => {
      const id = await settledOffer();

      await expect(dvp.connect(investor).mature(id)).to.be.revertedWithCustomError(dvp, 'NotScheduled');
      expect((await dvp.offerOf(id)).matured).to.equal(false);
    });

    it('refuses a second call on a receivable that has already matured', async () => {
      await settledOffer();

      await schedule.fire();

      await expect(schedule.fire()).to.be.revertedWith('scheduled call reverted');
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
