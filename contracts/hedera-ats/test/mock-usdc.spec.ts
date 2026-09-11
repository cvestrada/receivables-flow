import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MockUsdc__factory } from '../typechain-types';

/*
 * The dollar the demo settles in.
 *
 * Circle's USDC faucet on Hedera testnet hands out twenty dollars per address every two hours,
 * so a $50,000 repayment can never be funded with it. This token exists so the receivable can
 * keep its face value and still be paid for real — which means the only things worth testing
 * about it are the three the repayment depends on: that it is denominated like the money it
 * stands in for, that anybody can deposit it without asking, and that a transfer actually moves a
 * balance rather than merely emitting something.
 */

/** Ironline Freight's invoice, and so the amount a payer has to be able to mint itself. */
const FACE_VALUE_USD = 50_000;

/** Six decimals, which is what USDC uses and therefore what the split is worked out in. */
const DECIMALS = 6;

function dollars(amount: number): bigint {
  return ethers.parseUnits(amount.toString(), DECIMALS);
}

async function deploy() {
  const [deployer] = await ethers.getSigners();
  const dollar = await new MockUsdc__factory(deployer).deploy();
  await dollar.waitForDeployment();
  return dollar;
}

describe('MockUsdc', () => {
  describe('decimals', () => {
    it('is denominated the same way USDC is', async () => {
      const dollar = await deploy();

      expect(await dollar.decimals()).to.equal(DECIMALS);
    });
  });

  describe('deposit', () => {
    it('lets an account holding nothing deposit itself the full face value', async () => {
      const [payer] = await ethers.getSigners();
      const dollar = await deploy();

      expect(await dollar.balanceOf(payer.address)).to.equal(0n);
      await dollar.deposit(payer.address, dollars(FACE_VALUE_USD));

      expect(await dollar.balanceOf(payer.address)).to.equal(dollars(FACE_VALUE_USD));
    });

    it('lets a second account deposit without permission from the first', async () => {
      const [, stranger] = await ethers.getSigners();
      const dollar = await deploy();

      /* Nobody owns the right to issue it. A mint role would be one more credential to hold. */
      await dollar.connect(stranger).deposit(stranger.address, dollars(FACE_VALUE_USD));

      expect(await dollar.balanceOf(stranger.address)).to.equal(dollars(FACE_VALUE_USD));
    });

    it('leaves the balance where it was when nothing is deposited', async () => {
      const [payer] = await ethers.getSigners();
      const dollar = await deploy();
      await dollar.deposit(payer.address, dollars(100));

      await dollar.deposit(payer.address, 0n);

      expect(await dollar.balanceOf(payer.address)).to.equal(dollars(100));
    });
  });

  describe('transfer', () => {
    it('leaves the payer short by exactly what the holder gained', async () => {
      const [payer, holder] = await ethers.getSigners();
      const dollar = await deploy();
      await dollar.deposit(payer.address, dollars(FACE_VALUE_USD));

      const before = await dollar.balanceOf(payer.address);
      await dollar.transfer(holder.address, dollars(25_000));

      expect(before - (await dollar.balanceOf(payer.address))).to.equal(dollars(25_000));
      expect(await dollar.balanceOf(holder.address)).to.equal(dollars(25_000));
    });

    it('refuses a payer that does not hold enough, and moves no balance', async () => {
      const [payer, holder] = await ethers.getSigners();
      const dollar = await deploy();
      await dollar.deposit(payer.address, dollars(1_000));

      await expect(dollar.transfer(holder.address, dollars(25_000))).to.be.reverted;

      expect(await dollar.balanceOf(payer.address)).to.equal(dollars(1_000));
      expect(await dollar.balanceOf(holder.address)).to.equal(0n);
    });
  });
});
