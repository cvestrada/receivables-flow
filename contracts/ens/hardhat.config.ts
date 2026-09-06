import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

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
    /*
     * The integration tests run here, against a copy of Sepolia rather than a blank chain.
     * ENSv2 is a deployment we do not own, so a mock of it would assert our own guesses about
     * its permission rules — which is the one thing these tests exist to check. The block is
     * pinned so a run today and a run on demo day see the same registry.
     */
    hardhat: {
      forking: { url: sepoliaRpcUrl, blockNumber: 11644492 },
    },
    sepolia: {
      url: sepoliaRpcUrl,
      chainId: 11155111,
      accounts: privateKey ? [privateKey] : [],
    },
  },
  mocha: { timeout: 120_000 },
};

export default config;
