import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { IController__factory } from '@hashgraph/asset-tokenization-contracts';

/** Put every unit back with the fund's key — the state right after the primary sale. */
async function main(): Promise<void> {
  const { hederaTestnet } = JSON.parse(readFileSync(join(__dirname, '..', 'deployed.json'), 'utf8'));
  const [operator] = await ethers.getSigners();
  if (!operator) throw new Error('No account configured');

  const bridgeline = new Wallet(process.env.HEDERA_BRIDGELINE_WALLET_PRIVATE_KEY ?? '').address;
  const token = new ethers.Contract(hederaTestnet.receivableToken, ['function balanceOf(address) view returns (uint256)'], operator);
  const held = (await token.balanceOf(bridgeline)) as bigint;
  if (held === 0n) { console.log('nothing to move'); return; }

  const moved = await IController__factory.connect(hederaTestnet.receivableToken, operator)
    .controllerTransfer(bridgeline, operator.address, held, '0x', '0x', { gasLimit: 2_000_000 });
  await moved.wait();
  console.log(`moved ${Number(held) / 1e6} units bridgeline → fund key in ${moved.hash}`);
}
main().catch((error: unknown) => { console.error(error); process.exit(1); });
