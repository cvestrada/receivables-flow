import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ethers, network } from 'hardhat';
import { INVOICE } from '@rf/shared/invoice';
import { MockUsdc__factory } from '../typechain-types';

/**
 * Deploys the mock dollar and deposits the operator enough of it to repay the receivable.
 *
 * Deploying and funding are one script rather than two because a token nobody holds cannot pay
 * anybody, and a deploy that stopped short of depositing would leave day 60 exactly where it is
 * now — a correct division beside a line saying nothing was transferred.
 *
 * Re-running it is safe and deposits again. The token is a stand-in for dollars in a demo, and
 * there is nothing to protect by refusing a second run; being short at maturity is the failure
 * worth avoiding, not being over-funded.
 */

/** Six decimals, the same as the USDC this token stands in for. */
const DECIMALS = 6;

/**
 * Reads the balance back until it reflects the deposit.
 *
 * Hedera's JSON-RPC relay answers a read from its own view of state, which can still be a
 * block or two behind a transaction it has already confirmed. Printing that first answer
 * reports a balance of nought immediately after funding $50,000 — which reads as a failed
 * deposit and is not one. So the read is retried briefly rather than trusted once.
 */
async function settledBalance(
  dollar: { balanceOf: (who: string) => Promise<bigint> },
  who: string,
  expected: bigint,
): Promise<bigint> {
  let held = 0n;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    held = await dollar.balanceOf(who);
    if (held >= expected) return held;
    await new Promise((resume) => setTimeout(resume, 2_000));
  }

  return held;
}

async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();

  if (!operator) {
    throw new Error('No account configured — set HEDERA_OPERATOR_WALLET_PRIVATE_KEY in .env.local');
  }

  const dollar = await new MockUsdc__factory(operator).deploy();
  await dollar.waitForDeployment();
  const address = await dollar.getAddress();

  /*
   * The face value exactly, not a round number above it. What the operator holds is what the
   * repayment is allowed to be, so funding it to the penny is what makes a short balance on
   * day 60 a fault in the demo rather than a fault in this script.
   */
  const funding = ethers.parseUnits(INVOICE.faceValueUsd.toString(), DECIMALS);
  await (await dollar.deposit(operator.address, funding)).wait();

  const held = await settledBalance(dollar, operator.address, funding);

  console.log(`network  ${network.name}`);
  console.log(`dollar   ${address}`);
  console.log(`token    ${await dollar.name()} (${await dollar.symbol()}) · ${await dollar.decimals()} decimals`);
  console.log(`operator ${operator.address}`);
  console.log(`balance  ${Number(ethers.formatUnits(held, DECIMALS)).toFixed(DECIMALS)}`);
  console.log('');
  console.log('Paste this into the repository .env.local:');
  console.log(`HEDERA_MOCK_USDC_TOKEN_ADDRESS=${address}`);

  const path = join(__dirname, '..', 'deployed.json');
  const existing: Record<string, Record<string, unknown>> = JSON.parse(readFileSync(path, 'utf8'));
  existing[network.name] = { ...existing[network.name], testDollar: address };
  writeFileSync(path, `${JSON.stringify(existing, null, 2)}\n`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
