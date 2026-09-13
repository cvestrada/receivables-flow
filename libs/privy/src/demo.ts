import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { openedAccounts } from './accounts';

/**
 * The two on-chain moves a re-runnable demo needs, made by the platform key.
 *
 * The receivable is capped at its face value, so it can be minted exactly once — after which
 * "Approve & tokenize" would revert forever. And the fund has to end up holding what the
 * company minted, which is the primary sale the settlement contract does not yet drive.
 *
 * Both are done here as the security's controller, which ATS grants for exactly this: a platform
 * settling and redeeming on behalf of the parties. Every call is on HashScan like any other, and
 * neither pretends to be something it is not — a redemption is what happens to a receivable at
 * maturity, and a controller transfer is a settlement made by the venue.
 */

const RPC_URL = process.env.HEDERA_TESTNET_RPC_URL ?? 'https://testnet.hashio.io/api';

/** Stated, because Hedera's relay cannot be trusted to estimate it. */
const GAS = 2_000_000;

const ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function controllerTransfer(address from, address to, uint256 value, bytes data, bytes operatorData)',
  'function controllerRedeem(address tokenHolder, uint256 value, bytes data, bytes operatorData)',
];

function repoFile(...parts: string[]): string {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const candidate = join(dir, ...parts);
    if (existsSync(candidate)) return candidate;
    if (dirname(dir) === dir) throw new Error(`${parts.join('/')} not found above ${process.cwd()}`);
  }
}

function receivable(): string {
  const deployed = JSON.parse(readFileSync(repoFile('contracts', 'hedera-ats', 'deployed.json'), 'utf8')) as {
    hederaTestnet?: { receivableToken?: string };
  };
  const token = deployed.hederaTestnet?.receivableToken;
  if (!token) throw new Error('No receivable token recorded — run npm run issue -w @rf/contracts-hedera-ats');
  return token;
}

function controller(): Wallet {
  const key = process.env.HEDERA_OPERATOR_WALLET_PRIVATE_KEY;
  if (!key) throw new Error('HEDERA_OPERATOR_WALLET_PRIVATE_KEY is not set');
  return new Wallet(key, new JsonRpcProvider(RPC_URL, { name: 'hedera-testnet', chainId: 296 }));
}

/** Everyone who may be holding units at any point in the cycle. */
function holders(platform: Wallet): string[] {
  const { company } = openedAccounts();
  const bridgeline = process.env.HEDERA_BRIDGELINE_WALLET_PRIVATE_KEY;

  return [company.address, platform.address, ...(bridgeline ? [new Wallet(bridgeline).address] : [])];
}

/**
 * Move the company's whole position to the fund's signing key — the primary sale, settled.
 *
 * Called after the fund's account has signed the payment, so the two legs happen in the order
 * a settlement does: money first, units second.
 */
export async function settlePrimarySale(): Promise<{ hash?: string; units: string }> {
  const platform = controller();
  const token = new Contract(receivable(), ABI, platform);
  const { company } = openedAccounts();

  const held = (await token.balanceOf(company.address)) as bigint;
  if (held === 0n) return { units: '0' };

  const moved = await token.controllerTransfer(company.address, platform.address, held, '0x', '0x', {
    gasLimit: GAS,
  });
  const receipt = await moved.wait();

  return { hash: receipt?.hash as string, units: held.toString() };
}

/**
 * Redeem every unit anyone holds, so the receivable can be issued again.
 *
 * @returns One transaction per holder that held anything
 */
export async function redeemAll(): Promise<{ holder: string; units: string; hash: string }[]> {
  const platform = controller();
  const token = new Contract(receivable(), ABI, platform);
  const redeemed: { holder: string; units: string; hash: string }[] = [];

  for (const holder of holders(platform)) {
    const held = (await token.balanceOf(holder)) as bigint;
    if (held === 0n) continue;

    const burned = await token.controllerRedeem(holder, held, '0x', '0x', { gasLimit: GAS });
    const receipt = await burned.wait();
    redeemed.push({ holder, units: held.toString(), hash: receipt?.hash as string });
  }

  return redeemed;
}
