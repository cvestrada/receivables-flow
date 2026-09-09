/**
 * Every rule the two accounts run under, as plain data.
 *
 * Nothing here talks to Privy. Keeping the rules separate from the code that
 * sends them means a wrong threshold or a reversed comparison is caught by a
 * test that needs no credentials — a rule that is wrong here would be enforced
 * perfectly by Privy and still be wrong.
 */

/** How many of Ironline Freight's three people must approve before its account acts. */
export const APPROVERS_REQUIRED = 2;

/** How many people share Ironline Freight's account. */
export const APPROVER_COUNT = 3;

/** The most Woodgrove Capital may put into a single invoice. */
export const FUND_CAP_USD = 100_000;

/**
 * What one HBAR stands for in the story's dollars.
 *
 * The demo talks in tens of thousands of dollars, which no testnet faucet will
 * ever hand out. Scaling at one fixed published rate lets both accounts be
 * funded far above every amount attempted, so a refusal can never be mistaken
 * for an empty account.
 */
export const USD_PER_HBAR = 10_000;

const WEIBAR_PER_HBAR = 10n ** 18n;

/** Hedera's EVM interface counts value in weibar, the same 18 decimals as wei. */
export function usdToWeibar(usd: number): bigint {
  return (BigInt(usd) * WEIBAR_PER_HBAR) / BigInt(USD_PER_HBAR);
}

/**
 * The person behind an address, as a portal should name them.
 *
 * The demo's addresses are prefixed by which side of the deal someone is on, which
 * is useful in a mailbox and wrong on screen — a panel saying an approval came from
 * `business-anna` reads as a system account rather than as a person. Kept here
 * rather than beside the accounts because a browser needs it and this file is the
 * half of the package that carries nothing a browser cannot have.
 */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0].replace(/^(business|investor)-/, '');
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export interface ApprovingGroup {
  display_name: string;
  user_ids: string[];
  authorization_threshold: number;
}

export interface PolicyCondition {
  field_source: 'ethereum_transaction';
  field: string;
  operator: 'lte' | 'gt' | 'in_condition_set';
  value: string;
}

export interface PolicyRule {
  name: string;
  method: 'eth_sendTransaction';
  conditions: PolicyCondition[];
  action: 'ALLOW' | 'DENY';
}

export interface Policy {
  version: '1.0';
  name: string;
  chain_type: 'ethereum';
  rules: PolicyRule[];
}

/**
 * The group that owns Ironline Freight's account.
 *
 * Members are people with Privy dashboard logins rather than keys held by a
 * server, which is what makes the second approval a person deciding rather than
 * a process running.
 */
export function buildApprovingGroup(directorUserIds: string[]): ApprovingGroup {
  return {
    display_name: 'Ironline Freight directors',
    user_ids: directorUserIds,
    authorization_threshold: APPROVERS_REQUIRED,
  };
}

/**
 * Woodgrove Capital's mandate, written so its account cannot breach it.
 *
 * @param ratedListId - The list of invoices the platform has rated B or better
 */
export function buildFundPolicy(ratedListId: string): Policy {
  const cap = usdToWeibar(FUND_CAP_USD).toString();

  return {
    version: '1.0',
    name: 'Woodgrove Capital mandate',
    chain_type: 'ethereum',
    rules: [
      /*
       * The only thing the fund is ever permitted to do: buy an invoice that is
       * within the cap and on the rated list. Privy refuses any request that
       * matches no rule, so every other action is already denied by omission.
       */
      {
        name: 'Buy a rated invoice within the mandate',
        method: 'eth_sendTransaction',
        conditions: [
          { field_source: 'ethereum_transaction', field: 'value', operator: 'lte', value: cap },
          {
            field_source: 'ethereum_transaction',
            field: 'to',
            operator: 'in_condition_set',
            value: ratedListId,
          },
        ],
        action: 'ALLOW',
      },

      /*
       * Refusing over-mandate purchases outright, rather than leaving them to be
       * denied by omission, is what makes the refusal say why on camera.
       */
      {
        name: 'Refuse anything over the mandate',
        method: 'eth_sendTransaction',
        conditions: [
          { field_source: 'ethereum_transaction', field: 'value', operator: 'gt', value: cap },
        ],
        action: 'DENY',
      },
    ],
  };
}

/** Hedera testnet through its EVM interface. Both accounts sign for this chain only. */
export const HEDERA_CAIP2 = process.env.HEDERA_CAIP2 ?? 'eip155:296';

/**
 * A request to Privy, in the exact form the signature is taken over.
 *
 * Directors do not sign a transaction; they sign an API request. Privy verifies
 * each signature against these bytes, so what is described here is what is
 * approved.
 */
export interface SignableRequest {
  version: 1;
  url: string;
  method: 'POST';
  headers: { 'privy-app-id': string };
  body: {
    caip2: string;
    method: 'eth_sendTransaction';
    chain_type: 'ethereum';
    params: { transaction: { to: string; value: string; data: string } };
  };
}

function request(
  appId: string,
  walletId: string,
  transaction: { to: string; value: string; data: string },
): SignableRequest {
  return {
    version: 1,
    url: `https://api.privy.io/v1/wallets/${walletId}/rpc`,
    method: 'POST',
    headers: { 'privy-app-id': appId },
    body: {
      caip2: HEDERA_CAIP2,
      method: 'eth_sendTransaction',
      chain_type: 'ethereum',
      params: { transaction },
    },
  };
}

/** The invoice a sale hands over, carried as the transaction's data so it is part of what is signed. */
function invoiceMarker(invoiceId: string): string {
  return `0x${Buffer.from(invoiceId, 'utf8').toString('hex')}`;
}

/**
 * The sale of one invoice to one buyer, as the request two directors will each sign.
 *
 * Nothing in here varies between calls — no nonce, no timestamp, no clock. Two
 * directors approving at different hours must produce signatures over identical
 * bytes, because Privy counts signatures per request rather than per intent. A
 * single varying field would make the two approvals count as one approval of each
 * of two sales, and the sale would be refused for a reason indistinguishable from
 * the quorum working correctly.
 */
export function buildSaleRequest(sale: {
  appId: string;
  walletId: string;
  invoiceId: string;
  buyer: string;
}): SignableRequest {
  return request(sale.appId, sale.walletId, {
    to: sale.buyer,
    value: '0x0',
    data: invoiceMarker(sale.invoiceId),
  });
}

/**
 * The fund putting money into one invoice.
 *
 * The amount lands in the transaction's `value`, which is the field the fund's
 * mandate compares against — so the cap is enforced on the same number the
 * allocation actually moves.
 */
export function buildAllocationRequest(allocation: {
  appId: string;
  walletId: string;
  invoice: string;
  usd: number;
}): SignableRequest {
  return request(allocation.appId, allocation.walletId, {
    to: allocation.invoice,
    value: `0x${usdToWeibar(allocation.usd).toString(16)}`,
    data: '0x',
  });
}

/** The note counts in millionths of a note, so a whole note is 1,000,000 of them. */
export const NOTE_DECIMALS = 6;

/**
 * The first four bytes of `mint(address,uint256)`, which is how the note tells one
 * call from another.
 *
 * Written out rather than computed, because computing it means loading a chain
 * library into the half of this package a browser also loads. The issuance test
 * computes it from the deployed interface and fails if this ever stops matching.
 */
export const MINT_SELECTOR = '0x40c10f19';

/**
 * How many notes a face value issues, in the units the note itself counts in.
 *
 * One note per dollar, so the notes an investor buys read straight off as dollars
 * of the invoice.
 */
export function notesForFaceValue(faceValueUsd: number): bigint {
  return BigInt(faceValueUsd) * 10n ** BigInt(NOTE_DECIMALS);
}

/** One argument as the note reads it: 32 bytes, the value pushed to the right-hand end. */
function word(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

/**
 * The issuance of one invoice's notes, as the request two directors will each sign.
 *
 * The call is assembled by hand so that this file stays loadable in a browser — a
 * chain library here would pull node-only code into both portals. What is being
 * assembled is fixed by the note's own interface, not by us.
 *
 * Nothing in here varies between calls — no nonce, no timestamp, no clock. Two
 * directors approving at different hours must sign identical bytes, because Privy
 * counts signatures per request rather than per intent. A single varying field
 * would make the two approvals count as one approval each of two different
 * issuances, and the issuance would be refused for a reason indistinguishable from
 * the quorum working correctly.
 */
export function buildIssuanceRequest(issuance: {
  appId: string;
  walletId: string;
  /** The note being issued — the contract the call is addressed to. */
  note: string;
  /** The account the notes are issued to. */
  to: string;
  faceValueUsd: number;
}): SignableRequest {
  const recipient = word(BigInt(issuance.to));
  const notes = word(notesForFaceValue(issuance.faceValueUsd));

  return request(issuance.appId, issuance.walletId, {
    to: issuance.note,
    value: '0x0',
    data: `${MINT_SELECTOR}${recipient}${notes}`,
  });
}
