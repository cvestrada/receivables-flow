import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ethers, network } from 'hardhat';
import { approveHolder, grantIssuerRole, isApprovedHolder, readTerms, revokeIssuerRole } from '../src/receivable-token';

/**
 * Adopt a token that was already created, and hand issuing to the company account.
 *
 * The factory call is the expensive and flaky half of issuance on this network — it reverted
 * twice in a row for no reason either receipt would name, and succeeded in between. Creating a
 * third token to recover from that is worse than finishing the one that exists: this takes a
 * token address, checks the company can hold it, moves the right to issue to the company
 * account, takes it away from this laptop's key, and records the address.
 */
function company(): string {
  for (let dir = __dirname; ; dir = dirname(dir)) {
    const candidate = join(dir, 'libs', 'privy', 'accounts.json');
    try {
      return (JSON.parse(readFileSync(candidate, 'utf8')) as { company: { address: string } })
        .company.address;
    } catch {
      if (dirname(dir) === dir) throw new Error('libs/privy/accounts.json not found');
    }
  }
}

async function main(): Promise<void> {
  const token = process.env.TOKEN;
  if (!token) throw new Error('set TOKEN to the receivable token address');

  const [operator] = await ethers.getSigners();
  if (!operator) throw new Error('No account configured');

  const ironline = company();
  const terms = await readTerms(operator, token);

  console.log(`token    ${token}`);
  console.log(`face     $${terms.faceValueUsd.toLocaleString('en-US')}`);
  console.log(`matures  ${new Date(terms.maturityDate * 1000).toISOString()}`);
  /*
   * Both halves, because either one missing reverts the mint identically.
   *
   * The company account has to be allowed to *hold* the security — it is the first recipient of
   * its own note — and allowed to *issue* it. Provisioning creates a new company wallet whenever
   * it is re-run, so a token issued before that has a control list and a role table naming an
   * address nobody holds the keys to any more, and every approved financing reverts with
   * CONTRACT_REVERT_EXECUTED and no reason string.
   */
  if (!(await isApprovedHolder(operator, token, ironline))) {
    await approveHolder(operator, token, ironline);
    console.log(`holder   ${ironline} added to the control list`);
  } else {
    console.log(`holder   ${ironline} already approved`);
  }

  await grantIssuerRole(operator, token, ironline);
  await revokeIssuerRole(operator, token, operator.address);
  console.log(`issuer   moved to ${ironline}, taken from ${operator.address}`);

  const path = join(__dirname, '..', 'deployed.json');
  const deployed: Record<string, Record<string, unknown>> = JSON.parse(readFileSync(path, 'utf8'));
  deployed[network.name] = { ...deployed[network.name], receivableToken: token };
  writeFileSync(path, `${JSON.stringify(deployed, null, 2)}\n`);
  console.log(`recorded in deployed.json under ${network.name}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
