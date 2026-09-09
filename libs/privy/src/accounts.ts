/**
 * What the two portals call, and nothing about how the accounts were opened.
 *
 * Everything here runs on a server: it carries the app secret and the fund's
 * authorization key, neither of which may reach a browser. The directors'
 * approvals are the exception — those are made in the browser, by the director,
 * and arrive here already signed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { INVOICE } from '@rf/shared/invoice';
import {
  APPROVERS_REQUIRED,
  buildAllocationRequest,
  buildIssuanceRequest,
  buildSaleRequest,
  type SignableRequest,
} from './policies';

export { nameFromEmail } from './policies';

/*
 * Found by walking up from wherever the caller happens to be running.
 *
 * The same file is read by a test in `libs/privy`, by a route handler in each
 * portal, and by whatever else joins later — three different working directories
 * and, once a bundler is involved, no reliable path to this source file either.
 * One record of where the accounts are, found the same way from anywhere. The
 * bundler is told to leave the read alone: the path is resolved when a request
 * arrives, not when the app is built, and there is nothing here to trace.
 */
function accountsPath(): string {
  const override = process.env.PRIVY_ACCOUNTS_PATH;
  if (override) return override;

  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const candidate = join(dir, 'libs', 'privy', 'accounts.json');
    if (existsSync(candidate)) return candidate;
    if (dirname(dir) === dir) throw new Error('libs/privy/accounts.json not found — run provisioning');
  }
}

/*
 * The note's address, found the same way the accounts are.
 *
 * The issue run records it, and everything downstream reads it back rather than
 * being told it again — a note address written a second time somewhere else is a
 * second note waiting to be approved by mistake. The override exists so a run
 * against a freshly issued note needs no edit to a recorded file.
 */
export function noteAddress(): string {
  const override = process.env.RECEIVABLE_TOKEN_ADDRESS;
  if (override) return override;

  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const candidate = join(dir, 'contracts', 'hedera-ats', 'deployed.json');
    if (existsSync(candidate)) {
      const deployed = JSON.parse(readFileSync(/* turbopackIgnore: true */ candidate, 'utf8')) as {
        hederaTestnet?: { receivableToken?: string };
      };
      const note = deployed.hederaTestnet?.receivableToken;
      if (!note) throw new Error('No receivable note recorded — run npm run issue -w @rf/contracts-hedera-ats');
      return note;
    }
    if (dirname(dir) === dir) {
      throw new Error('contracts/hedera-ats/deployed.json not found — run npm run issue -w @rf/contracts-hedera-ats');
    }
  }
}

/** One of the three people who together own Ironline Freight's account. */
export interface Director {
  /** How the portal refers to them. */
  name: string;
  /** What they sign in with, and where Privy sends their code. */
  email: string;
  /** Who they are to Privy, and therefore who counts toward the two. */
  userId: string;
}

export interface OpenedAccounts {
  company: { address: string; walletId: string; quorumId: string; directors: Director[] };
  fund: { address: string; walletId: string; policyId: string };
  ratedListId: string;
  /** What this run of provisioning created. Empty on every run after the first. */
  created: string[];
}

/** One director's approval of one sale, as it arrives from their browser. */
export interface Approval {
  userId: string;
  name: string;
  signature: string;
}

/** A sale on offer and the approvals gathered for it so far. */
export interface ApprovalRecord {
  sale: SignableRequest;
  approvals: Approval[];
  required?: number;
  ready?: boolean;
}

export interface CountedApprovals {
  sale: SignableRequest;
  approvals: Approval[];
  required: number;
  ready: boolean;
}

export interface Sent {
  hash: string;
}

/**
 * Add one director's approval to a sale.
 *
 * A director who approves twice replaces their own approval rather than adding a
 * second. Privy would reject two signatures from one key anyway, so the reason to
 * do it here is the screen: without this, one person clicking twice reads as two
 * of two, and the portal claims a quorum that does not exist.
 */
export function recordApproval(record: ApprovalRecord, approval: Approval): CountedApprovals {
  const others = record.approvals.filter((held) => held.userId !== approval.userId);
  const approvals = [...others, approval];

  return {
    sale: record.sale,
    approvals,
    required: APPROVERS_REQUIRED,
    ready: approvals.length >= APPROVERS_REQUIRED,
  };
}

/** The accounts as `provision.ts` left them. */
export function openedAccounts(): OpenedAccounts {
  return JSON.parse(readFileSync(/* turbopackIgnore: true */ accountsPath(), 'utf8')) as OpenedAccounts;
}

function appId(): string {
  const id = process.env.PRIVY_APP_ID;
  if (!id) throw new Error('PRIVY_APP_ID is not set');
  return id;
}

function basicAuth(): string {
  const secret = process.env.PRIVY_APP_SECRET;
  if (!secret) throw new Error('PRIVY_APP_SECRET is not set');
  return Buffer.from(`${appId()}:${secret}`).toString('base64');
}

/**
 * Send a signed request to Privy and surface its refusal unchanged.
 *
 * The reason a refusal gives is the product here, so it is passed along rather
 * than translated. A message we wrote would be a message we could write whether
 * or not anything refused.
 */
async function send(req: SignableRequest, signatures: string[]): Promise<Sent> {
  const response = await fetch(req.url, {
    method: req.method,
    headers: {
      ...req.headers,
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/json',
      'privy-authorization-signature': signatures.join(','),
    },
    body: JSON.stringify(req.body),
  });

  const body = (await response.json()) as { data?: { hash?: string }; error?: unknown };

  if (!response.ok) {
    throw new Error(`Privy refused (${response.status}): ${JSON.stringify(body.error ?? body)}`);
  }

  return { hash: body.data?.hash ?? '' };
}

/** The sale currently on offer, as the request each director signs in their browser. */
export function saleToApprove(invoiceId: string): SignableRequest {
  const accounts = openedAccounts();

  return buildSaleRequest({
    appId: appId(),
    walletId: accounts.company.walletId,
    invoiceId,
    buyer: accounts.fund.address,
  });
}

/**
 * The issuance currently on offer, as the request each director signs in their browser.
 *
 * Both halves come from a record rather than from an argument: the note from what
 * the issue run wrote down, the face value from the invoice itself. Nothing a
 * caller passes can change what the directors are asked to approve.
 */
export function issuanceToApprove(): SignableRequest {
  const accounts = openedAccounts();

  return buildIssuanceRequest({
    appId: appId(),
    walletId: accounts.company.walletId,
    note: noteAddress(),
    to: accounts.company.address,
    faceValueUsd: INVOICE.faceValueUsd,
  });
}

/**
 * Send an approved request carrying the approvals collected so far.
 *
 * Deliberately willing to send too few. The portal offers that button so the
 * refusal can be produced on demand, and the refusal has to come from Privy
 * counting the signatures — not from us declining to ask.
 */
export function sendApproved(request: SignableRequest, approvals: Approval[]): Promise<Sent> {
  return send(
    request,
    approvals.map((approval) => approval.signature),
  );
}

/**
 * Ask the fund's account to sign an allocation.
 *
 * `invoice` is an address: the seller being paid stands in for the invoice being
 * bought until the receivable token exists. Passing `'company'` names Ironline
 * Freight, the one address on the platform's rated list.
 */
export function allocate(allocation: { invoice: string; usd: number }): Promise<Sent> {
  const accounts = openedAccounts();
  const invoice =
    allocation.invoice === 'company' ? accounts.company.address : allocation.invoice;

  const key = process.env.PRIVY_AUTHORIZATION_KEY;
  if (!key) throw new Error('PRIVY_AUTHORIZATION_KEY is not set');

  return send(
    buildAllocationRequest({
      appId: appId(),
      walletId: accounts.fund.walletId,
      invoice,
      usd: allocation.usd,
    }),
    [key],
  );
}

/** What each account currently holds, in the chain's smallest unit. */
export async function balances(): Promise<{ company: bigint; fund: bigint }> {
  const accounts = openedAccounts();
  const rpc = process.env.HEDERA_RPC_URL ?? 'https://testnet.hashio.io/api';

  async function held(address: string): Promise<bigint> {
    const response = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });
    const { result } = (await response.json()) as { result: string };
    return BigInt(result);
  }

  return {
    company: await held(accounts.company.address),
    fund: await held(accounts.fund.address),
  };
}
