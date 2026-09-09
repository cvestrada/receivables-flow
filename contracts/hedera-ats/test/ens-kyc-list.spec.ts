import { time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { Signer } from 'ethers';
import { deploySystemWithNewBlr } from '@hashgraph/asset-tokenization-contracts/scripts';
import { IAllowance__factory, IBalanceTracker__factory } from '@hashgraph/asset-tokenization-contracts';
import { MockUsdc__factory, ReceivableDvp__factory } from '../typechain-types';
import type { MockUsdc, ReceivableDvp } from '../typechain-types';
import {
  approvalOf,
  deployEnsKycList,
  isKycApproved,
  publishKyc,
  withdrawKyc,
} from '../src/ens-kyc-list';
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

const YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

const IRONLINE = 'ironline.business.receivablesflow.eth';
const WOODGROVE = 'woodgrove.investor.receivablesflow.eth';

describe('EnsKycList', () => {
  let ats: AtsDeployment;
  let platform: Signer;
  let business: Signer;
  let investor: Signer;
  let stranger: Signer;
  let platformAddress: string;
  let businessAddress: string;
  let investorAddress: string;
  let strangerAddress: string;

  let list: string;
  let dvp: ReceivableDvp;
  let usdc: MockUsdc;
  let token: string;

  /*
   * The ATS facets are shared implementation, not per-token state, so the system is deployed
   * once for the file. Every test still issues its own token with its own list attached.
   */
  before(async function () {
    this.timeout(600_000);
    [platform, business, investor, stranger] = await ethers.getSigners();
    [platformAddress, businessAddress, investorAddress, strangerAddress] = await Promise.all([
      platform.getAddress(),
      business.getAddress(),
      investor.getAddress(),
      stranger.getAddress(),
    ]);

    const deployment = await deploySystemWithNewBlr(platform, 'hardhat', {
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

  /** A moment comfortably ahead of the chain's clock, for an approval that has not run out. */
  async function farFuture(seconds = YEAR_IN_SECONDS): Promise<number> {
    return (await time.latest()) + seconds;
  }

  beforeEach(async function () {
    this.timeout(180_000);

    list = await deployEnsKycList(platform);
    dvp = await new ReceivableDvp__factory(platform).deploy();
    usdc = await new MockUsdc__factory(platform).deploy();
  });

  describe('getKycStatus', () => {
    it('reports a wallet KYC approved while its approval is still ahead of the clock', async () => {
      await publishKyc(platform, list, investorAddress, await farFuture(), WOODGROVE);

      expect(await isKycApproved(platform, list, investorAddress)).to.equal(true);
    });

    /*
     * "Approved until" and "approved through" differ by one second, and only one of them
     * matches what the ENS name says. The second the approval names is already too late.
     */
    it('reports a wallet not approved at the exact second its approval expires', async () => {
      const expiresAt = await farFuture(3_600);
      await publishKyc(platform, list, investorAddress, expiresAt, WOODGROVE);

      await time.increaseTo(expiresAt - 1);
      expect(await isKycApproved(platform, list, investorAddress)).to.equal(true);

      await time.increaseTo(expiresAt);
      expect(await isKycApproved(platform, list, investorAddress)).to.equal(false);
    });

    it('reports a wallet nobody ever published as not approved', async () => {
      expect(await isKycApproved(platform, list, strangerAddress)).to.equal(false);
    });

    it('reports a wallet withdrawn before its expiry as not approved from then on', async () => {
      await publishKyc(platform, list, investorAddress, await farFuture(), WOODGROVE);
      expect(await isKycApproved(platform, list, investorAddress)).to.equal(true);

      await withdrawKyc(platform, list, investorAddress);

      expect(await isKycApproved(platform, list, investorAddress)).to.equal(false);
    });
  });

  describe('publish', () => {
    it('records the ENS name an approval came from beside the wallet', async () => {
      const expiresAt = await farFuture();
      await publishKyc(platform, list, investorAddress, expiresAt, WOODGROVE);

      const approval = await approvalOf(platform, list, investorAddress);
      expect(approval.name).to.equal(WOODGROVE);
      expect(approval.expiresAt).to.equal(BigInt(expiresAt));
    });

    it('leaves the answer unchanged when the same wallet and expiry are published twice', async () => {
      const expiresAt = await farFuture();
      await publishKyc(platform, list, investorAddress, expiresAt, WOODGROVE);
      await publishKyc(platform, list, investorAddress, expiresAt, WOODGROVE);

      const approval = await approvalOf(platform, list, investorAddress);
      expect(approval.expiresAt).to.equal(BigInt(expiresAt));
      expect(await isKycApproved(platform, list, investorAddress)).to.equal(true);
    });

    it('refuses an account that is not the publisher', async () => {
      await expect(
        publishKyc(stranger, list, strangerAddress, await farFuture(), WOODGROVE),
      ).to.be.reverted;

      expect(await isKycApproved(platform, list, strangerAddress)).to.equal(false);
    });
  });

  describe('withdraw', () => {
    it('refuses an account that is not the publisher', async () => {
      await publishKyc(platform, list, investorAddress, await farFuture(), WOODGROVE);

      await expect(withdrawKyc(stranger, list, investorAddress)).to.be.reverted;

      expect(await isKycApproved(platform, list, investorAddress)).to.equal(true);
    });
  });

  describe('settle', () => {
    /*
     * Every sale test starts from the same place: the business is KYC approved and holds the
     * whole invoice, the settlement contract may move it, and both parties are on the token's
     * approved-holder list. The only thing a test varies is the buyer's or seller's KYC, so a
     * refusal can only have come from the KYC gate.
     */
    beforeEach(async function () {
      this.timeout(180_000);

      token = await issueReceivableToken(
        platform,
        ats,
        ACME_INVOICE,
        [businessAddress, investorAddress, strangerAddress, await dvp.getAddress()],
        [list],
      );

      await publishKyc(platform, list, businessAddress, await farFuture(), IRONLINE);
      await mintTo(platform, token, businessAddress, Number(UNITS));

      await IAllowance__factory.connect(token, business).approve(await dvp.getAddress(), UNITS);
    });

    /** Puts the whole invoice on offer and returns its id. */
    async function openOffer(): Promise<bigint> {
      const usdcAddress = await usdc.getAddress();
      const id = await dvp.connect(business).offer.staticCall(token, UNITS, usdcAddress, PRICE);
      await dvp.connect(business).offer(token, UNITS, usdcAddress, PRICE);
      return id;
    }

    /** Funds a buyer with USDC and authorises the payment leg. */
    async function fundBuyer(buyer: Signer, amount = PRICE): Promise<void> {
      await usdc.mint(await buyer.getAddress(), amount);
      await usdc.connect(buyer).approve(await dvp.getAddress(), amount);
    }

    it('lets an investor whose KYC is approved buy from a business whose KYC is approved', async () => {
      await publishKyc(platform, list, investorAddress, await farFuture(), WOODGROVE);
      await fundBuyer(investor);
      const id = await openOffer();

      await dvp.connect(investor).settle(id);

      const balances = IBalanceTracker__factory.connect(token, platform);
      expect(await balances.balanceOf(investorAddress)).to.equal(UNITS);
      expect(await usdc.balanceOf(businessAddress)).to.equal(PRICE);
    });

    /*
     * The refusal a judge sees. Nothing in our code decides it — the token consults the list
     * inside the transfer, and because both legs share one transaction the payment comes back
     * with the units the buyer never received.
     */
    it('refuses a buyer whose KYC was rejected, and moves neither the money nor the units', async () => {
      await publishKyc(platform, list, investorAddress, await farFuture(), WOODGROVE);
      await withdrawKyc(platform, list, investorAddress);
      await fundBuyer(investor);
      const id = await openOffer();

      await expect(dvp.connect(investor).settle(id)).to.be.reverted;

      const balances = IBalanceTracker__factory.connect(token, platform);
      expect(await balances.balanceOf(investorAddress)).to.equal(0n);
      expect(await balances.balanceOf(businessAddress)).to.equal(UNITS);
      expect(await usdc.balanceOf(investorAddress)).to.equal(PRICE);
      expect(await usdc.balanceOf(businessAddress)).to.equal(0n);
    });

    /*
     * Nobody calls anything between the approval and the refusal. The list stores the expiry
     * rather than a yes or no, so the clock alone is what changes the answer.
     */
    it('refuses a buyer whose approval has run out, with no call in between', async () => {
      const expiresAt = await farFuture(3_600);
      await publishKyc(platform, list, investorAddress, expiresAt, WOODGROVE);
      await fundBuyer(investor);
      const id = await openOffer();

      await time.increaseTo(expiresAt);

      await expect(dvp.connect(investor).settle(id)).to.be.reverted;

      const balances = IBalanceTracker__factory.connect(token, platform);
      expect(await balances.balanceOf(investorAddress)).to.equal(0n);
      expect(await usdc.balanceOf(investorAddress)).to.equal(PRICE);
    });

    it('refuses a buyer nobody published', async () => {
      await fundBuyer(stranger);
      const id = await openOffer();

      await expect(dvp.connect(stranger).settle(id)).to.be.reverted;

      const balances = IBalanceTracker__factory.connect(token, platform);
      expect(await balances.balanceOf(strangerAddress)).to.equal(0n);
      expect(await usdc.balanceOf(strangerAddress)).to.equal(PRICE);
    });

    /*
     * The half of this the issue title does not say. ATS validates the sender as well as the
     * recipient, so a business whose KYC was rejected cannot sell the invoice it already owns.
     */
    it('refuses a seller whose KYC was rejected, even to an approved buyer', async () => {
      await publishKyc(platform, list, investorAddress, await farFuture(), WOODGROVE);
      await fundBuyer(investor);
      const id = await openOffer();

      await withdrawKyc(platform, list, businessAddress);

      await expect(dvp.connect(investor).settle(id)).to.be.reverted;

      const balances = IBalanceTracker__factory.connect(token, platform);
      expect(await balances.balanceOf(businessAddress)).to.equal(UNITS);
      expect(await usdc.balanceOf(businessAddress)).to.equal(0n);
    });
  });
});
