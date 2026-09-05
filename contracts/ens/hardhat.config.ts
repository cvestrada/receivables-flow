import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

/*
 * One network per package, deliberately. This package holds who may trade and what they have done before.
 * The other half of the project deploys to a different chain from its own package,
 * so a deploy can never land on the wrong network by picking the wrong flag.
 */
const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com',
      chainId: 11155111,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
