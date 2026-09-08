import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ethers, network } from 'hardhat';
import { ReceivableDvp__factory } from '../typechain-types';

/**
 * Deploys the settlement contract and records its address.
 *
 * This is the one contract the project deploys itself, so its address is what gets verified
 * on HashScan. It holds no state that matters across deployments — offers are opened after
 * the fact — so redeploying is safe, but the address is written down because the portals and
 * the README both point at it.
 */
async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();

  if (!operator) {
    throw new Error('No account configured — set the private key in .env');
  }

  const dvp = await new ReceivableDvp__factory(operator).deploy();
  await dvp.waitForDeployment();
  const address = await dvp.getAddress();

  console.log(`network  ${network.name}`);
  console.log(`dvp      ${address}`);

  const path = join(__dirname, '..', 'deployed.json');
  const existing: Record<string, Record<string, unknown>> = JSON.parse(readFileSync(path, 'utf8'));
  existing[network.name] = { ...existing[network.name], receivableDvp: address };
  writeFileSync(path, `${JSON.stringify(existing, null, 2)}\n`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
