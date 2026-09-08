/**
 * Opens both accounts with their rules already attached, once.
 *
 * The rules are attached at the moment each account is created rather than
 * applied to it afterwards, so there is no window in which either account exists
 * without its rule. Everything created is written to `accounts.json`, which is
 * how both portals find the accounts without holding any credential of their own.
 */

import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPROVERS_REQUIRED, buildApprovingGroup, buildFundPolicy } from './policies';
import type { OpenedAccounts } from './accounts';

const ACCOUNTS_PATH = join(import.meta.dirname, '..', 'accounts.json');
const API = 'https://api.privy.io/v1';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see libs/privy/.env.example`);
  return value;
}

async function privy<T>(path: string, body: unknown): Promise<T> {
  const auth = Buffer.from(`${env('PRIVY_APP_ID')}:${env('PRIVY_APP_SECRET')}`).toString('base64');

  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'privy-app-id': env('PRIVY_APP_ID'),
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`POST ${path} failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

/** The three directors, as Privy knows them. */
function directors(): string[] {
  const ids = env('PRIVY_DIRECTOR_USER_IDS')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length !== 3) {
    throw new Error(`PRIVY_DIRECTOR_USER_IDS must name three directors, found ${ids.length}`);
  }

  return ids;
}

/**
 * Open both accounts, or report the ones already open.
 *
 * Provisioning is run by hand and re-run whenever something around it changes, so
 * a second run must be free. `accounts.json` is the record of what exists; if it
 * is there, nothing is created.
 */
export async function openAccounts(): Promise<OpenedAccounts> {
  if (existsSync(ACCOUNTS_PATH)) {
    const open = JSON.parse(readFileSync(ACCOUNTS_PATH, 'utf8')) as OpenedAccounts;
    return { ...open, created: [] };
  }

  const group = buildApprovingGroup(directors());
  const quorum = await privy<{ id: string }>('/key_quorums', group);

  const company = await privy<{ id: string; address: string }>('/wallets', {
    chain_type: 'ethereum',
    owner_id: quorum.id,
  });

  /*
   * The rated list is created empty and Ironline Freight is added to it, because
   * "rated B or better" is a list the platform maintains rather than a number the
   * fund's rule can read. Rating another business later means adding it here — the
   * fund's mandate is never rewritten.
   */
  const ratedList = await privy<{ id: string }>('/condition_sets', {
    name: 'Invoices rated B or better',
    type: 'ethereum_address',
    values: [company.address],
  });

  const policy = await privy<{ id: string }>('/policies', buildFundPolicy(ratedList.id));

  const fund = await privy<{ id: string; address: string }>('/wallets', {
    chain_type: 'ethereum',
    owner_id: env('PRIVY_AUTHORIZATION_KEY_ID'),
    policy_ids: [policy.id],
  });

  const opened: OpenedAccounts = {
    company: { address: company.address, walletId: company.id, quorumId: quorum.id },
    fund: { address: fund.address, walletId: fund.id, policyId: policy.id },
    ratedListId: ratedList.id,
    created: ['company account', 'rated list', 'fund mandate', 'fund account'],
  };

  writeFileSync(ACCOUNTS_PATH, `${JSON.stringify(opened, null, 2)}\n`);
  return opened;
}

if (process.argv[1] === import.meta.filename) {
  const opened = await openAccounts();
  console.log(
    opened.created.length
      ? `Opened: ${opened.created.join(', ')} — ${APPROVERS_REQUIRED} of 3 approve for Ironline Freight`
      : 'Nothing created — both accounts were already open',
  );
  console.log(`accounts.json → ${ACCOUNTS_PATH}`);
}
