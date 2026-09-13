import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ethers } from 'hardhat';
import { ATS_ROLES } from '@hashgraph/asset-tokenization-contracts/scripts';
import { hasRole, isApprovedHolder } from '../src/receivable-token';

/**
 * Who can do what on a receivable token, and who is allowed to hold it.
 *
 * Written after an approved financing reverted with nothing but CONTRACT_REVERT_EXECUTED. A mint
 * has two preconditions — the caller holds ROLE_ISSUER, and the recipient is on the control list
 * — and the receipt names neither when it fails. This prints both, for the operator key and for
 * the company account, which is enough to tell a permissions problem from a contract problem.
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

  for (const [who, address] of [
    ['operator', operator.address],
    ['company ', ironline],
  ] as const) {
    const roles: string[] = [];
    for (const [name, role] of Object.entries(ATS_ROLES)) {
      if (await hasRole(operator, token, role, address)) roles.push(name);
    }

    console.log(`${who} ${address}`);
    console.log(`  may hold : ${(await isApprovedHolder(operator, token, address)) ? 'yes' : 'NO'}`);
    console.log(`  roles    : ${roles.length ? roles.join(', ') : 'none'}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
