import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ethers } from 'hardhat';

/**
 * Put testnet HBAR into the accounts provisioning opened.
 *
 * A Privy wallet is created empty, and an empty account cannot pay for its own transactions —
 * Privy reports that as "Insufficient funds for transfer", which on a screen about a mandate
 * reads as the mandate refusing. Provisioning opens new wallets every time it runs, so this is
 * run after it rather than once.
 */
const TOP_UP_HBAR = '40';

function accounts(): Record<string, string> {
  for (let dir = __dirname; ; dir = dirname(dir)) {
    const candidate = join(dir, 'libs', 'privy', 'accounts.json');
    try {
      const held = JSON.parse(readFileSync(candidate, 'utf8')) as Record<
        string,
        { address?: string }
      >;
      return Object.fromEntries(
        Object.entries(held)
          .filter(([, value]) => typeof value === 'object' && value?.address)
          .map(([name, value]) => [name, value.address as string]),
      );
    } catch {
      if (dirname(dir) === dir) throw new Error('libs/privy/accounts.json not found');
    }
  }
}

async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();
  if (!operator) throw new Error('No account configured');

  for (const [name, address] of Object.entries(accounts())) {
    const before = await ethers.provider.getBalance(address);

    if (before >= ethers.parseEther('10')) {
      console.log(`${name.padEnd(8)} ${address} already holds ${ethers.formatEther(before)}`);
      continue;
    }

    const sent = await operator.sendTransaction({
      to: address,
      value: ethers.parseEther(TOP_UP_HBAR),
    });
    await sent.wait();

    const after = await ethers.provider.getBalance(address);
    console.log(`${name.padEnd(8)} ${address} funded → ${ethers.formatEther(after)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
