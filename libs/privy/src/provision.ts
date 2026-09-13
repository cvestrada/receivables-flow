/**
 * Opens both accounts with their rules already attached, once.
 *
 * The rules are attached at the moment each account is created rather than
 * applied to it afterwards, so there is no window in which either account exists
 * without its rule. Everything created is written to `accounts.json`, which is
 * how both portals find the accounts without holding any credential of their own.
 */

import { generateKeyPairSync } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPROVERS_REQUIRED, buildApprovingGroup, buildFundPolicy } from './policies';
import { authorizationSignature } from './signing';
import { nameFromEmail, type Director, type OpenedAccounts } from './accounts';

/*
 * Every credential this repository needs lives in one file at the root, so a value shared by
 * the contracts, the accounts and the portals is changed once rather than copied into each
 * directory that reads it. `.env.local` is read first and wins, which is where the real keys
 * are kept; `.env` is the committed fallback. Bare `dotenv/config` would only find a file
 * beside whichever directory the process happened to start in, which is how the same key
 * ended up in three.
 */
loadEnv({ path: join(import.meta.dirname, '..', '..', '..', '.env.local') });
loadEnv({ path: join(import.meta.dirname, '..', '..', '..', '.env') });

const ACCOUNTS_PATH = join(import.meta.dirname, '..', 'accounts.json');

/**
 * Where the two keys this company signs with are kept.
 *
 * Not in `accounts.json`, which is read by both portals and is safe to look at: these are
 * private keys. Testnet demo keys with nothing behind them, and still private keys, so they
 * live in their own gitignored file and are generated rather than typed into an environment.
 */
const KEYS_PATH = join(import.meta.dirname, '..', 'keys.json');

/** One P-256 keypair, in the encodings Privy takes: base64 DER, no PEM wrapper. */
function newKey(): { publicKey: string; privateKey: string } {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

  return {
    publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}
const API = 'https://api.privy.io/v1';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see libs/privy/.env.example`);
  return value;
}

async function privy<T>(path: string, body: unknown, signed = false): Promise<T> {
  const auth = Buffer.from(`${env('PRIVY_APP_ID')}:${env('PRIVY_APP_SECRET')}`).toString('base64');

  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'privy-app-id': env('PRIVY_APP_ID'),
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...(signed
        ? {
            'privy-authorization-signature': authorizationSignature({
              appId: env('PRIVY_APP_ID'),
              url: `${API}${path}`,
              body,
              key: env('PRIVY_FUND_AUTHORIZATION_KEY'),
            }),
          }
        : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`POST ${path} failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

/**
 * The three directors, created from their email addresses if they do not exist.
 *
 * Naming them by email rather than by Privy user id keeps the whole setup in one
 * file: nobody has to sign in first, read an opaque identifier off a dashboard and
 * paste it back. A director signing in later with the same address lands on the
 * account made here, so the group is built over the same three people either way.
 */
async function directors(): Promise<Director[]> {
  const emails = env('PRIVY_BUSINESS_DIRECTOR_EMAILS')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  if (emails.length !== 3) {
    throw new Error(`PRIVY_BUSINESS_DIRECTOR_EMAILS must name three directors, found ${emails.length}`);
  }

  const found: Director[] = [];
  for (const email of emails) {
    /*
     * Asked for first, created second. Provisioning is re-run whenever anything
     * around it changes, and creating a director who already exists would either
     * fail or quietly make a second person out of one.
     */
    const existing = await find('/users/email/address', { address: email });
    const userId =
      existing?.id ??
      (
        await privy<{ id: string }>('/users', {
          linked_accounts: [{ type: 'email', address: email }],
        })
      ).id;

    found.push({ name: nameFromEmail(email), email, userId });
  }

  return found;
}

/** Look something up, distinguishing "not there" from a real failure. */
async function find(path: string, body: unknown): Promise<{ id: string } | null> {
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

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`POST ${path} failed (${response.status}): ${await response.text()}`);

  return (await response.json()) as { id: string };
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

  const board = await directors();

  /*
   * Two keys this company holds: one its finance system signs financings with, one that keeps
   * the visiting seat updatable. They are separate on purpose — a single key sitting in both
   * seats could meet the threshold of two on its own, which would make the second signature
   * decorative.
   */
  const system = newKey();
  const seatHolder = newKey();

  const visitingSeat = await privy<{ id: string }>('/key_quorums', {
    display_name: 'Ironline Freight — visiting director',
    public_keys: [seatHolder.publicKey],
    authorization_threshold: 1,
  });

  /*
   * Seat one is a director with her own login, seat two is the finance system, seat three is
   * the visitor. Two of the three must sign, and the first two can never be the same key.
   */
  const group = buildApprovingGroup(
    [board[0].userId],
    system.publicKey,
    visitingSeat.id,
  );
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
  /*
   * The name carries the company's own address because Privy requires condition-set names to
   * be unique within an app and offers no way to look one up by name — a re-run with a plain
   * name fails on the collision and cannot recover the id it collided with. Tying the name to
   * the wallet it is about makes a second run a second, honest set rather than a dead end.
   */
  const ratedList = await privy<{ id: string }>('/condition_sets', {
    name: `Invoices rated B or better — ${company.address.slice(0, 10)}`,
    owner_id: env('PRIVY_FUND_AUTHORIZATION_KEY_ID'),
  });

  /*
   * The set is created empty and filled in a second call, because that is the shape of the
   * API: a condition set is a named, owned thing, and its members are items under it, posted
   * as a bare array. Adding one is a change to something the fund owns, so it carries the
   * fund's own signature.
   */
  await privy(
    `/condition_sets/${ratedList.id}/condition_set_items`,
    [{ value: company.address }],
    true,
  );

  const policy = await privy<{ id: string }>('/policies', buildFundPolicy(ratedList.id));

  const fund = await privy<{ id: string; address: string }>('/wallets', {
    chain_type: 'ethereum',
    owner_id: env('PRIVY_FUND_AUTHORIZATION_KEY_ID'),
    policy_ids: [policy.id],
  });

  writeFileSync(
    KEYS_PATH,
    `${JSON.stringify({ system, seatHolder, visitingSeatId: visitingSeat.id }, null, 2)}\n`,
  );

  const opened: OpenedAccounts = {
    company: {
      address: company.address,
      walletId: company.id,
      quorumId: quorum.id,
      visitingSeatId: visitingSeat.id,
      /*
       * Written down so the record of who may approve outlives the environment
       * variable that named them. Reading it back is how anyone answers "who are
       * the three?" without a dashboard.
       */
      directors: board,
    },
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
