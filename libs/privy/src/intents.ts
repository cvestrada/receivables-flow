import { existsSync, readFileSync } from 'node:fs';
import { issuanceToApprove, openedAccounts } from './accounts';
import { APPROVERS_REQUIRED, type SignableRequest } from './policies';
import { authorizationSignature } from './signing';

/**
 * The financing, as a thing Privy holds rather than a note we keep.
 *
 * The company wallet takes two signatures of three. We used to collect those ourselves in a
 * file and hand both to Privy at once, which meant our own code decided when a sale was
 * allowed to go through. An intent is Privy's own object for the same job: the financing is
 * proposed once, signatures are appended to it as people approve, and Privy executes it the
 * moment the threshold is met. Nothing of ours is in that decision.
 *
 * The first signature is the company's own finance system, whose key sits in one of the three
 * seats. The second has to come from a person — which, in this demo, is whoever signed in.
 */

const API = 'https://api.privy.io/v1';

/** The seat keys provisioning generated, beside accounts.json and never in it. */
interface CompanyKeys {
  system: { publicKey: string; privateKey: string };
  seatHolder: { publicKey: string; privateKey: string };
  visitingSeatId: string;
}

/** How an intent reads once Privy has it. */
export interface Financing {
  intentId: string;
  status: 'pending' | 'processing' | 'executed' | 'failed' | 'expired' | 'rejected' | 'dismissed';
  /** Signatures gathered so far, and how many this wallet requires. */
  signed: number;
  required: number;
  /** The transaction hash, once Privy has executed it. */
  hash?: string;
  /** What the request is, so a signer can sign the same bytes we proposed. */
  request: SignableRequest;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function basicAuth(): string {
  return Buffer.from(`${env('PRIVY_APP_ID')}:${env('PRIVY_APP_SECRET')}`).toString('base64');
}

function keys(): CompanyKeys {
  const path = process.env.PRIVY_KEYS_JSON_PATH ?? keysBesideAccounts();
  if (!existsSync(path)) throw new Error('libs/privy/keys.json not found — run provisioning');

  return JSON.parse(readFileSync(/* turbopackIgnore: true */ path, 'utf8')) as CompanyKeys;
}

function keysBesideAccounts(): string {
  const accounts = process.env.PRIVY_ACCOUNTS_JSON_PATH;
  if (accounts) return accounts.replace(/accounts\.json$/, 'keys.json');

  return new URL('../keys.json', import.meta.url).pathname;
}

async function privy<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'privy-app-id': env('PRIVY_APP_ID'),
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Privy refused (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

/** Privy's own shape for an intent, narrowed to what the screen needs. */
interface IntentResponse {
  intent_id: string;
  status: Financing['status'];
  authorization_details?: {
    threshold: number;
    members: { signed_at?: number | null; threshold_met?: boolean }[];
  }[];
  action_result?: { response_body?: { hash?: string; transaction_hash?: string } };
}

/** How many of the seats have signed, counting a nested seat that has met its own threshold. */
function signaturesOn(intent: IntentResponse): number {
  const quorum = intent.authorization_details?.[0];
  if (!quorum) return 0;

  return quorum.members.filter((member) => member.signed_at ?? member.threshold_met).length;
}

function read(intent: IntentResponse, request: SignableRequest): Financing {
  const result = intent.action_result?.response_body;

  return {
    intentId: intent.intent_id,
    status: intent.status,
    signed: signaturesOn(intent),
    required: intent.authorization_details?.[0]?.threshold ?? APPROVERS_REQUIRED,
    hash: result?.hash ?? result?.transaction_hash,
    request,
  };
}

/**
 * Propose the financing and sign it once, as the company's finance system.
 *
 * Signing here rather than leaving it unsigned is the honest shape of the story: a company's
 * own system asking for money is not the same as a company deciding to sell an invoice, which
 * is why the threshold is two and why this signature alone does nothing.
 */
export async function proposeFinancing(): Promise<Financing> {
  const { company } = openedAccounts();
  const request = issuanceToApprove();

  const intent = await privy<IntentResponse>(`/intents/wallets/${company.walletId}/rpc`, {
    method: 'POST',
    body: JSON.stringify(request.body),
  });

  const signed = await authorizeFinancing(
    intent.intent_id,
    authorizationSignature({
      appId: env('PRIVY_APP_ID'),
      url: request.url,
      body: request.body,
      key: keys().system.privateKey,
    }),
    Date.now(),
  );

  return signed;
}

/**
 * Add one signature to the financing.
 *
 * Privy checks the signature against the seats on the wallet and executes the transaction
 * itself once enough of them have signed. A signature from someone who holds no seat is
 * refused here, which is the point: this route cannot let anyone through.
 *
 * @param intentId - The financing being signed
 * @param signature - An authorization signature over the financing's own request
 * @param timestamp - When that signature was made, in milliseconds
 */
export async function authorizeFinancing(
  intentId: string,
  signature: string,
  timestamp: number,
): Promise<Financing> {
  const intent = await privy<IntentResponse>(`/intents/${intentId}/authorize`, {
    method: 'POST',
    body: JSON.stringify({ signature, timestamp }),
  });

  return read(intent, issuanceToApprove());
}

/** Read a financing back, which is how the screen learns Privy executed it. */
export async function financingStatus(intentId: string): Promise<Financing> {
  const intent = await privy<IntentResponse>(`/intents/${intentId}`);

  return read(intent, issuanceToApprove());
}
