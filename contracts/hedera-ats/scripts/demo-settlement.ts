import { ethers } from 'hardhat';
import { deploySystemWithNewBlr } from '@hashgraph/asset-tokenization-contracts/scripts';
import { IAllowance__factory, IBalanceTracker__factory } from '@hashgraph/asset-tokenization-contracts';
import { MockUsdc__factory, ReceivableDvp__factory } from '../typechain-types';
import { approveHolder, isApprovedHolder, issueReceivableToken, mintTo } from '../src/receivable-token';

const UNITS = 50_000n;
const PRICE = 47_500_000_000n;

const line = (label: string, value: string) => console.log(`  ${label.padEnd(22)}${value}`);
const step = (n: string, title: string) => console.log(`\n${'─'.repeat(64)}\n${n}  ${title}\n${'─'.repeat(64)}`);
const usd = (amount: bigint) => `$${(amount / 1_000_000n).toLocaleString('en-US')}`;

/**
 * Shows the sale settling as one exchange, and refusing as one refusal.
 *
 * The point a viewer has to see is the second column: when the buyer is not approved, the
 * units do not move *and neither does the money*. Two separate transfers could not do that.
 */
async function main(): Promise<void> {
  const [business, investor, stranger] = await ethers.getSigners();

  step('SETUP', 'Stand up ATS and the settlement contract');
  const system = await deploySystemWithNewBlr(business, 'hardhat', {
    useTimeTravel: false,
    saveOutput: false,
    deployOnlyBondConfig: true,
    verifyDeployment: false,
  });
  const ats = { factory: system.infrastructure.factory.proxy, resolver: system.infrastructure.blr.proxy };

  const dvp = await new ReceivableDvp__factory(business).deploy();
  const usdc = await new MockUsdc__factory(business).deploy();
  const dvpAddress = await dvp.getAddress();
  line('ATS factory', ats.factory);
  line('settlement contract', `${dvpAddress} — the only Solidity we wrote`);

  step('1', 'Ironline Freight offers invoice #1042 for sale');
  const token = await issueReceivableToken(
    business,
    ats,
    { reference: 'Acme Invoice #1042', code: 'RF1042', faceValueUsd: 50_000, maturityDays: 60 },
    [business.address],
  );
  await mintTo(business, token, business.address, Number(UNITS));

  /* Listed as a spender, not a holder: it moves the units, it never keeps them. */
  await approveHolder(business, token, dvpAddress);
  await IAllowance__factory.connect(token, business).approve(dvpAddress, UNITS);

  const id = await dvp.connect(business).offer.staticCall(token, UNITS, await usdc.getAddress(), PRICE);
  await dvp.connect(business).offer(token, UNITS, await usdc.getAddress(), PRICE);

  const balances = IBalanceTracker__factory.connect(token, business);
  line('receivable', `${token}`);
  line('face value', '$50,000, payable in 60 days');
  line('asking price', `${usd(PRICE)} — the discount is the investor's return`);
  line('offer id', id.toString());

  step('2', 'A wallet nobody approved tries to buy it');
  await usdc.mint(stranger.address, PRICE);
  await usdc.connect(stranger).approve(dvpAddress, PRICE);
  line('buyer', stranger.address);
  line('on approved list?', String(await isApprovedHolder(business, token, stranger.address)));
  line('buyer USDC before', usd(await usdc.balanceOf(stranger.address)));

  try {
    await dvp.connect(stranger).settle(id);
    console.log('\n  ⚠️  SETTLEMENT SUCCEEDED — the lock is not working\n');
  } catch {
    line('settle result', 'REFUSED — the receivable rejected the buyer');
  }
  line('buyer USDC after', `${usd(await usdc.balanceOf(stranger.address))} — the payment came back with it`);
  line('buyer units', `${(await balances.balanceOf(stranger.address)).toString()} units`);
  line('business USDC', `${usd(await usdc.balanceOf(business.address))} — nothing was taken`);

  step('3', 'Woodgrove Capital, an approved investor, buys it');
  await approveHolder(business, token, investor.address);
  await usdc.mint(investor.address, PRICE);
  await usdc.connect(investor).approve(dvpAddress, PRICE);
  line('buyer', investor.address);
  line('on approved list?', String(await isApprovedHolder(business, token, investor.address)));
  line('buyer USDC before', usd(await usdc.balanceOf(investor.address)));
  line('business units before', `${(await balances.balanceOf(business.address)).toString()} units`);

  const receipt = await (await dvp.connect(investor).settle(id)).wait();
  line('settle result', `SETTLED in one transaction — ${receipt?.hash}`);
  line('buyer USDC after', usd(await usdc.balanceOf(investor.address)));
  line('buyer units after', `${(await balances.balanceOf(investor.address)).toString()} units = $50,000 of face value`);
  line('business USDC after', `${usd(await usdc.balanceOf(business.address))} — funded`);
  line('business units after', `${(await balances.balanceOf(business.address)).toString()} units`);
  console.log('');
}

main().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});
