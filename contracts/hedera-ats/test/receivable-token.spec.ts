import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { Signer } from 'ethers';
import { deploySystemWithNewBlr } from '@hashgraph/asset-tokenization-contracts/scripts';
import { IBalanceTracker__factory, ITransfer__factory } from '@hashgraph/asset-tokenization-contracts';
import {
  approveHolder,
  isApprovedHolder,
  issueReceivableToken,
  mintTo,
  readTerms,
  revokeHolder,
  type AtsDeployment,
  type Invoice,
} from '../src/receivable-token';

const ACME_INVOICE: Invoice = {
  reference: 'Acme Invoice #1042',
  code: 'RF1042',
  faceValueUsd: 50_000,
  maturityDays: 60,
};

const DAY_IN_SECONDS = 24 * 60 * 60;

describe('ReceivableToken', () => {
  let ats: AtsDeployment;
  let issuer: Signer;
  let investor: Signer;
  let stranger: Signer;
  let investorAddress: string;
  let strangerAddress: string;
  let issuerAddress: string;

  /*
   * The ATS facets are shared implementation, not per-token state, so they are
   * deployed once for the file. Every test still issues its own token below.
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

  describe('issueReceivableToken', () => {
    it('records the invoice face value and maturity on the token itself', async function () {
      this.timeout(120_000);
      const issuedAt = (await ethers.provider.getBlock('latest'))!.timestamp;

      const token = await issueReceivableToken(issuer, ats, ACME_INVOICE, [issuerAddress]);
      const terms = await readTerms(issuer, token);

      expect(terms.faceValueUsd).to.equal(50_000);
      expect(terms.maturityDate).to.be.closeTo(issuedAt + 60 * DAY_IN_SECONDS, 300);
    });
  });

  describe('transfer', () => {
    let token: string;

    beforeEach(async function () {
      this.timeout(120_000);
      token = await issueReceivableToken(issuer, ats, ACME_INVOICE, [issuerAddress]);
      await mintTo(issuer, token, issuerAddress, 50_000);
    });

    it('moves the balance when the receiver is an approved investor', async () => {
      await approveHolder(issuer, token, investorAddress);

      const transferable = ITransfer__factory.connect(token, issuer);
      await transferable.transfer(investorAddress, 10_000);

      const balances = IBalanceTracker__factory.connect(token, issuer);
      expect(await balances.balanceOf(investorAddress)).to.equal(10_000n);
    });

    it('refuses the transfer when the receiver was never approved', async () => {
      const transferable = ITransfer__factory.connect(token, issuer);

      await expect(transferable.transfer(strangerAddress, 10_000)).to.be.reverted;

      const balances = IBalanceTracker__factory.connect(token, issuer);
      expect(await balances.balanceOf(strangerAddress)).to.equal(0n);
      expect(await isApprovedHolder(issuer, token, strangerAddress)).to.equal(false);
    });

    it('refuses the transfer once the receiver approval is withdrawn', async () => {
      await approveHolder(issuer, token, investorAddress);
      const transferable = ITransfer__factory.connect(token, issuer);
      await transferable.transfer(investorAddress, 1_000);

      await revokeHolder(issuer, token, investorAddress);

      await expect(transferable.transfer(investorAddress, 1_000)).to.be.reverted;

      const balances = IBalanceTracker__factory.connect(token, issuer);
      expect(await balances.balanceOf(investorAddress)).to.equal(1_000n);
      expect(await isApprovedHolder(issuer, token, investorAddress)).to.equal(false);
    });
  });

  describe('approveHolder', () => {
    it('refuses a caller that does not hold the compliance role', async function () {
      this.timeout(120_000);
      const token = await issueReceivableToken(issuer, ats, ACME_INVOICE, [issuerAddress]);

      await expect(approveHolder(stranger, token, strangerAddress)).to.be.rejected;
      expect(await isApprovedHolder(issuer, token, strangerAddress)).to.equal(false);
    });
  });
});
