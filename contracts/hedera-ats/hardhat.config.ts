import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const privateKey = process.env.HEDERA_OPERATOR_KEY;

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
    hederaTestnet: {
      url: process.env.HEDERA_TESTNET_RPC_URL ?? 'https://testnet.hashio.io/api',
      chainId: 296,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
