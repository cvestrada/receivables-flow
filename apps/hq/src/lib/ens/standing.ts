import { JsonRpcProvider } from 'ethers';
import { readPass, type RegistryRef } from '@rf/contracts-ens';
import deployed from '@rf/contracts-ens/deployed.json';

/** One row on the page: a party, and whether its KYC is approved right now. */
export interface Party {
  /** The label its name is registered under — `woodgrove`, `ironline`. */
  id: string;
  /** How staff refer to it. */
  label: string;
  /** Which side of the trade it is on, which decides where its name lives. */
  side: 'company' | 'fund';
  name: string;
  /** The wallet this party is, as onboarding recorded it — what approving names. */
  subject: string;
  /** The wallet its record names right now, which rejecting empties. */
  wallet: string;
  approved: boolean;
  /** The day the approval runs out, or an em dash when there is none. */
  until: string;
}

/**
 * Turn what the chain says into the row staff read.
 *
 * Approved means both halves agree: a wallet is named, and the date has not passed. Split out
 * from the read so the one judgement the page makes can be checked against dates directly.
 */
export function toParty(
  base: Pick<Party, 'id' | 'label' | 'side' | 'name' | 'subject'>,
  wallet: string,
  expiresAt: bigint,
  at: bigint,
): Party {
  const approved = wallet !== '' && expiresAt > 0n && at < expiresAt;

  return {
    ...base,
    wallet: wallet || '—',
    approved,
    until: expiresAt > 0n ? new Date(Number(expiresAt) * 1000).toISOString().slice(0, 10) : '—',
  };
}

interface Deployment {
  businesses?: RegistryRef;
  investors?: RegistryRef;
  business?: { name: string; wallet?: string };
  investor?: { name: string; wallet?: string };
}

/**
 * Everyone HQ can decide about, and where each one's name lives.
 *
 * Taken from what onboarding recorded rather than typed in here, so a party that was never
 * onboarded cannot appear on the page as though it had been.
 */
function roster(): { base: Pick<Party, 'id' | 'label' | 'side' | 'name' | 'subject'>; registry?: RegistryRef }[] {
  const { businesses, investors, business, investor } = deployed as Deployment;
  const label = (name?: string) => name?.split('.')[0] ?? '';

  return [
    {
      base: {
        id: label(business?.name) || 'ironline',
        label: 'Ironline Freight',
        side: 'company',
        name: business?.name ?? '',
        subject: business?.wallet ?? '',
      },
      registry: businesses,
    },
    {
      base: {
        id: label(investor?.name) || 'woodgrove',
        label: 'Woodgrove Capital',
        side: 'fund',
        name: investor?.name ?? '',
        subject: investor?.wallet ?? '',
      },
      registry: investors,
    },
  ];
}

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';

/** Where a party's name lives, for the actions that write to it. */
export function registryFor(side: Party['side']): RegistryRef | undefined {
  const { businesses, investors } = deployed as Deployment;
  return side === 'company' ? businesses : investors;
}

/**
 * Read every party's KYC from Sepolia.
 *
 * Read on each request rather than cached, because a decision made here has to show up on the
 * next paint — and because the page has no business holding an opinion the registry does not.
 */
export async function parties(): Promise<Party[]> {
  const provider = new JsonRpcProvider(RPC_URL);

  try {
    const now = BigInt((await provider.getBlock('latest'))?.timestamp ?? 0);

    return await Promise.all(
      roster().map(async ({ base, registry }) => {
        if (!registry || !base.name) return toParty(base, '', 0n, now);

        const answer = await readPass(provider, registry, base.id);
        return toParty(base, answer.wallet, answer.expiresAt, now);
      }),
    );
  } finally {
    provider.destroy();
  }
}
