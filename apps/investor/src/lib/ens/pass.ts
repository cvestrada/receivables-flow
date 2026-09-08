import { JsonRpcProvider } from 'ethers';
import { readPass } from '@rf/contracts-ens';
import deployed from '@rf/contracts-ens/deployed.json';

/**
 * What the portal shows about the fund's clearance.
 *
 * The date is kept as the day rather than the second, because that is the unit the pass is
 * actually granted in and the unit a compliance officer reads.
 */
export interface PassView {
  name: string;
  wallet: string;
  expiresOn: string;
  cleared: boolean;
}

/**
 * The pass as the portal falls back to describing it when nothing has been onboarded yet.
 *
 * Shown as not cleared rather than as an error. A fund with no pass on chain is exactly a fund
 * that may not hold a receivable, so the honest screen is the same one it would see if its
 * pass had lapsed.
 */
const NONE: PassView = {
  name: 'woodgrove.receivablesflow.eth',
  wallet: '—',
  expiresOn: '—',
  cleared: false,
};

interface Deployment {
  baseName?: string;
  registry?: string;
  investor?: { name: string };
}

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';

/**
 * Read Woodgrove's approval pass from Sepolia.
 *
 * The portal reads the chain rather than a copy of it kept here, so the screen cannot claim a
 * fund is cleared after the registry has stopped saying so. The read goes through a public
 * endpoint with no key, which is the same route a counterparty checking the fund would take.
 */
export async function investorPass(): Promise<PassView> {
  const { baseName, registry } = deployed as Deployment;
  if (!baseName || !registry) return NONE;

  const provider = new JsonRpcProvider(RPC_URL);
  try {
    const label = (deployed as Deployment).investor?.name.split('.')[0] ?? 'woodgrove';
    const answer = await readPass(provider, { baseName, registry }, label);

    return {
      name: answer.name,
      wallet: answer.wallet || '—',
      expiresOn:
        answer.expiresAt > 0n
          ? new Date(Number(answer.expiresAt) * 1000).toISOString().slice(0, 10)
          : '—',
      cleared: answer.cleared,
    };
  } finally {
    provider.destroy();
  }
}
