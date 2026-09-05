import { ethers } from 'hardhat';

/**
 * Reports the balance of the account this package deploys with.
 *
 * Exits non-zero on an empty or unconfigured account. A package can be wired
 * perfectly and still be unable to deploy anything, and a scaffold check that
 * passes in that state hides the one problem it was meant to catch.
 */
async function main(): Promise<void> {
  const [account] = await ethers.getSigners();

  if (!account) {
    throw new Error('No account configured — set the private key in .env');
  }

  const balance = await ethers.provider.getBalance(account.address);

  console.log(`account ${account.address}`);
  console.log(`balance ${ethers.formatEther(balance)}`);

  if (balance === 0n) {
    throw new Error('Account has no funds — top it up before deploying');
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
