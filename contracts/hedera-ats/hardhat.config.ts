import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

/*
 * Every credential this repository needs lives in one `.env` at the root, so a value shared by
 * the contracts, the accounts and the portals is changed once rather than copied into each
 * directory that reads it. Bare `dotenv/config` would only find a file beside whichever
 * directory the process happened to start in, which is how the same key ended up in three.
 */
for (const file of ['.env.local', '.env']) {
  loadEnv({ path: join(__dirname, '..', '..', file) });
}

const privateKey = process.env.HEDERA_OPERATOR_WALLET_PRIVATE_KEY;

/*
 * One network per package, deliberately. This package issues and settles the receivable token.
 * The other half of the project deploys to a different chain from its own package,
 * so a deploy can never land on the wrong network by picking the wrong flag.
 */
const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { allowUnlimitedContractSize: true, blockGasLimit: 200_000_000 },
    hederaTestnet: {
      url: process.env.HEDERA_TESTNET_RPC_URL ?? 'https://testnet.hashio.io/api',
      chainId: 296,
      accounts: privateKey ? [privateKey] : [],
      /*
       * State the gas rather than letting it be estimated.
       *
       * Hedera's JSON-RPC relay answers `eth_estimateGas` for a contract creation with about
       * 115,000 whatever is being deployed, so ethers sent an ATS bond deployment with a
       * fraction of the gas it needs. It ran out, and Hedera reports running out the same way it
       * reports a revert: `status: 0`, no logs, no reason — which is why this looked for weeks
       * like an intermittent contract failure. 15,000,000 is the network's own per-transaction
       * ceiling, and unused gas is not charged.
       */
      gas: 15_000_000,
    },
  },
};

export default config;
