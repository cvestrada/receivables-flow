import { ethers } from 'hardhat';
import { JsonRpcProvider } from 'ethers';
import { deploySystemWithNewBlr } from '@hashgraph/asset-tokenization-contracts/scripts';
import { IAllowance__factory, IBalanceTracker__factory } from '@hashgraph/asset-tokenization-contracts';
import { creditScore, readRecord } from '@rf/contracts-ens';
import ensDeployed from '@rf/contracts-ens/deployed.json';
import { MockScheduleService__factory, MockUsdc__factory, ReceivableDvp__factory } from '../typechain-types';
import { approveHolder, isApprovedHolder, issueReceivableToken, mintTo } from '../src/receivable-token';
import { priceFor } from '../src/pricing';

const FACE_VALUE_USD = 50_000;
const MATURITY_DAYS = 60;
const UNITS = BigInt(FACE_VALUE_USD);

/** Where Hedera's schedule service answers on every Hedera network. */
const SCHEDULE_SERVICE = '0x000000000000000000000000000000000000016b';

const line = (label: string, value: string) => console.log(`  ${label.padEnd(22)}${value}`);
const step = (n: string, title: string) => console.log(`\n${'─'.repeat(64)}\n${n}  ${title}\n${'─'.repeat(64)}`);
const usd = (amount: bigint) => `$${(Number(amount) / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const day = (seconds: bigint) => new Date(Number(seconds) * 1000).toISOString().slice(0, 10);

/**
 * Works out Ironline Freight's score from the counts on its public profile.
 *
 * The profile lives on Sepolia while the sale happens on Hedera, so this reaches out to the
 * public record over its own connection — the same route a counterparty checking the business
 * for themselves would take. Nothing here is a grade anyone assigned: the score is what its
 * matured invoices earned under the published formula, and a business with nothing matured yet
 * comes back unrated rather than scored.
 *
 * @returns The score out of 100, or null when no invoice has matured yet
 */
async function publishedScore(): Promise<number | null> {
  const { business } = ensDeployed as { business?: { name: string; resolver: string } };
  if (!business) return null;

  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co');
  try {
    const count = async (key: string) =>
      Number(await readRecord(provider, business.resolver, business.name, key)) || 0;
    const [financed, ontime, late, defaulted] = await Promise.all([
      count('rf.invoices.financed'),
      count('rf.invoices.ontime'),
      count('rf.invoices.late'),
      count('rf.invoices.defaulted'),
    ]);

    return creditScore({ financed, ontime, late, defaulted }) ?? null;
  } finally {
    provider.destroy();
  }
}

/**
 * Makes sure something answers where the schedule service lives.
 *
 * Hedera has the real thing at that address. Hardhat is a plain EVM with nothing there, so the
 * stand-in's code is placed at it — otherwise the sale would fail locally at the booking step
 * for a reason that has nothing to do with what the demo is showing.
 */
async function ensureScheduleService(): Promise<boolean> {
  if ((await ethers.provider.getCode(SCHEDULE_SERVICE)) !== '0x') return true;

  const [operator] = await ethers.getSigners();
  const stand = await new MockScheduleService__factory(operator).deploy();
  await ethers.provider.send('hardhat_setCode', [
    SCHEDULE_SERVICE,
    await ethers.provider.getCode(await stand.getAddress()),
  ]);
  await MockScheduleService__factory.connect(SCHEDULE_SERVICE, operator).reset();
  return false;
}

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
  const onHedera = await ensureScheduleService();
  line('ATS factory', ats.factory);
  line('settlement contract', `${dvpAddress} — the only Solidity we wrote`);
  line('schedule service', onHedera ? `${SCHEDULE_SERVICE} — the real one` : `${SCHEDULE_SERVICE} — stand-in, no Hedera here`);

  step('1', 'Ironline Freight offers invoice #1042 for sale');
  const token = await issueReceivableToken(
    business,
    ats,
    { reference: 'Acme Invoice #1042', code: 'RF1042', faceValueUsd: FACE_VALUE_USD, maturityDays: MATURITY_DAYS },
    [business.address],
  );
  await mintTo(business, token, business.address, Number(UNITS));

  /* Listed as a spender, not a holder: it moves the units, it never keeps them. */
  await approveHolder(business, token, dvpAddress);
  await IAllowance__factory.connect(token, business).approve(dvpAddress, UNITS);

  /*
   * The price is worked out here rather than written down. Face value and maturity come from
   * the invoice; the grade comes from Ironline's own public profile. Anyone who disagrees with
   * the number can read the same three inputs and check it.
   */
  const score = await publishedScore();
  const quote = priceFor(FACE_VALUE_USD, MATURITY_DAYS, score);
  const price = quote.price;

  const terms = [token, UNITS, await usdc.getAddress(), price, MATURITY_DAYS] as const;
  const id = await dvp.connect(business).offer.staticCall(...terms);
  await dvp.connect(business).offer(...terms);

  const balances = IBalanceTracker__factory.connect(token, business);
  line('receivable', `${token}`);
  line('face value', `$${FACE_VALUE_USD.toLocaleString('en-US')}, payable in ${MATURITY_DAYS} days`);
  line('published score', score === null ? 'unrated — nothing matured yet, priced at the bottom' : `${score} out of 100`);
  line('annual rate', `${(quote.annualRateBps / 100).toFixed(2)}% on a 360-day year`);
  line('discount', `${usd(quote.discount)} — the investor's return`);
  line('asking price', `${usd(price)} — worked out, not typed in`);
  line('offer id', id.toString());

  step('2', 'A wallet nobody approved tries to buy it');
  await usdc.mint(stranger.address, price);
  await usdc.connect(stranger).approve(dvpAddress, price);
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
  await usdc.mint(investor.address, price);
  await usdc.connect(investor).approve(dvpAddress, price);
  line('buyer', investor.address);
  line('on approved list?', String(await isApprovedHolder(business, token, investor.address)));
  line('buyer USDC before', usd(await usdc.balanceOf(investor.address)));
  line('business units before', `${(await balances.balanceOf(business.address)).toString()} units`);

  const receipt = await (await dvp.connect(investor).settle(id)).wait();
  line('settle result', `SETTLED in one transaction — ${receipt?.hash}`);
  line('buyer USDC after', usd(await usdc.balanceOf(investor.address)));
  line(
    'buyer units after',
    `${(await balances.balanceOf(investor.address)).toString()} units = $${FACE_VALUE_USD.toLocaleString('en-US')} of face value`,
  );
  line('business USDC after', `${usd(await usdc.balanceOf(business.address))} — funded`);
  line('business units after', `${(await balances.balanceOf(business.address)).toString()} units`);

  step('4', 'The repayment is already booked, in that same transaction');
  const settled = await dvp.offerOf(id);
  line('booked schedule', settled.schedule);
  line('runs on', `${day(settled.maturesAt)} — ${MATURITY_DAYS} days after the money moved`);
  line('matured yet?', String(settled.matured));
  if (onHedera) {
    line('see it waiting', `https://hashscan.io/testnet/schedule/${settled.schedule}`);
  }
  console.log('');
}

main().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});
