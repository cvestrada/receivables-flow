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
loadEnv({ path: join(__dirname, '..', '..', '.env') });

const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const shouldFork = process.env.ENS_FORK === '1';
const forkBlock = process.env.ENS_FORK_BLOCK ? Number(process.env.ENS_FORK_BLOCK) : undefined;

/*
 * Forking needs an endpoint that still serves state for the block it forked at. Most free
 * Sepolia RPCs prune within minutes, which surfaces mid-run as `historical state is not
 * available` rather than as a connection error, so the fork endpoint is configured separately
 * from the one used to deploy.
 */
const forkRpcUrl = process.env.ENS_FORK_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';

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
     * Forking is opt-in, because only the integration tests need it. Booting a fork for the
     * unit tests costs a network round trip and fails on any RPC that has pruned the block —
     * a failure in code that never touches a chain.
     *
     * The block is left unpinned by default. Public RPCs keep only recent state, so a pinned
     * block works until it is pruned and then breaks for everyone but the machine that cached
     * it. Set ENS_FORK_BLOCK against an archive node when a byte-identical replay matters.
     */
    hardhat: shouldFork
      ? {
          forking: {
            url: forkRpcUrl,
            ...(forkBlock === undefined ? {} : { blockNumber: forkBlock }),
          },
        }
      : {},
    sepolia: {
      url: sepoliaRpcUrl,
      chainId: 11155111,
      accounts: privateKey ? [privateKey] : [],
    },
  },
  mocha: { timeout: 120_000 },
};

export default config;
