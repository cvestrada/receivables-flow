'use server';

import { revalidatePath } from 'next/cache';
import { JsonRpcProvider, Wallet } from 'ethers';
import { issuePass, revokePass } from '@rf/contracts-ens';

import { registryFor, type Party } from './standing';

/**
 * How long an approval lasts.
 *
 * A quarter is the interval a fund's accreditation is actually reviewed on, and the same term
 * onboarding uses — a second number here would mean the page and the script disagreed about
 * what approving means.
 */
const TERM_SECONDS = 90 * 24 * 60 * 60;

export interface Decision {
  ok: boolean;
  /** The transaction this decision made, when it made one. */
  hash?: string;
  /** Why nothing happened, in words staff can act on. */
  problem?: string;
}

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';

/**
 * The platform's own account, on the server only.
 *
 * This is the account that owns every name under `receivablesflow.eth`, so it is the one thing
 * on this page that must never reach a browser. It is read here, inside a server action, and
 * the signer it produces never crosses back.
 */
function platform() {
  const key = process.env.SEPOLIA_PLATFORM_PRIVATE_KEY;
  if (!key) return undefined;

  const provider = new JsonRpcProvider(RPC_URL);
  return new Wallet(key, provider);
}

async function decide(
  party: Pick<Party, 'id' | 'side' | 'wallet'>,
  write: (signer: NonNullable<ReturnType<typeof platform>>, registry: NonNullable<ReturnType<typeof registryFor>>) => Promise<string | undefined>,
): Promise<Decision> {
  const registry = registryFor(party.side);
  if (!registry) return { ok: false, problem: 'Nothing has been onboarded on this network yet.' };

  const signer = platform();
  if (!signer) return { ok: false, problem: 'No platform key configured — set SEPOLIA_PLATFORM_PRIVATE_KEY.' };

  try {
    const hash = await write(signer, registry);
    // The page reads the chain on every request, so re-reading is the whole of the update.
    revalidatePath('/');
    return { ok: true, hash };
  } catch (error) {
    return { ok: false, problem: (error as Error).message };
  } finally {
    (signer.provider as JsonRpcProvider).destroy();
  }
}

/** Pass this party's KYC: name the wallet it clears, for a fixed term. */
export async function approve(party: Pick<Party, 'id' | 'side' | 'wallet'>, wallet: string): Promise<Decision> {
  return decide(party, async (signer, registry) => {
    const pass = await issuePass(signer as never, registry, party.id, wallet, TERM_SECONDS);
    return pass.hash;
  });
}

/** Fail this party's KYC: take the wallet off its record, so it reads as not approved. */
export async function reject(party: Pick<Party, 'id' | 'side' | 'wallet'>): Promise<Decision> {
  return decide(party, (signer, registry) => revokePass(signer as never, registry, party.id));
}
