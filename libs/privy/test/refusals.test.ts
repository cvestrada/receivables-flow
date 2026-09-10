import { beforeAll, describe, expect, it } from 'vitest';
import { FUND_CAP_USD, notesForFaceValue, type SignableRequest } from '../src/policies';
import { INVOICE } from '@rf/shared/invoice';
import {
  allocate,
  balances,
  issuanceToApprove,
  noteAddress,
  sendApproved,
  type Approval,
} from '../src/accounts';
import { openAccounts } from '../src/provision';

/*
 * These assert that Privy refuses, not that we do. That is the whole claim of this
 * lane, and it cannot be made against a mock: a mocked refusal proves only that we
 * wrote a mock that refuses. So each group stands down without its credentials
 * rather than substituting a fake and reporting a pass.
 */
const FUND_LIVE = Boolean(process.env.PRIVY_APP_SECRET && process.env.PRIVY_FUND_AUTHORIZATION_KEY);

/*
 * A director approves in their browser, with a key only they hold. Reaching that
 * key from a test means holding a signed-in director's access token, so this group
 * runs only when three of them are supplied. When they are not, the company's
 * refusal is the one checked by hand in the portal — which is where the issue asks
 * for it anyway.
 */
const DIRECTOR_TOKENS = (process.env.PRIVY_BUSINESS_DIRECTOR_ACCESS_TOKENS ?? '')
  .split(',')
  .map((token) => token.trim())
  .filter(Boolean);

const WITHIN_MANDATE_USD = 47_500;
const NOTES_ISSUED = notesForFaceValue(INVOICE.faceValueUsd);

/** `totalSupply()` — the note answers this without an ABI, so nothing chain-shaped is imported here. */
const TOTAL_SUPPLY_SELECTOR = '0x18160ddd';
const OVER_MANDATE_USD = 150_000;

/** An invoice nobody has rated, so it is on no list the fund may buy from. */
const UNRATED_INVOICE = `0x${'9'.repeat(40)}`;

/**
 * Every refusal here must name the rule that refused it.
 *
 * An account with no money refuses everything too, at the same point in the same
 * call. Asserting only that the call failed would let an empty account masquerade
 * as a working control for as long as it stayed empty.
 */
function refusedByRule(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  expect(message).not.toMatch(/insufficient|balance|funds/i);
  return message;
}

/**
 * How many notes the note itself says exist.
 *
 * Read off the chain rather than off a receipt, because a receipt says a
 * transaction was accepted and this has to say the supply changed.
 */
async function noteSupply(): Promise<bigint> {
  const rpc = process.env.HEDERA_TESTNET_RPC_URL ?? 'https://testnet.hashio.io/api';
  const response = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: noteAddress(), data: TOTAL_SUPPLY_SELECTOR }, 'latest'],
    }),
  });
  const { result } = (await response.json()) as { result: string };
  return BigInt(result);
}

/** One director approving the request, signing with the key their own session holds. */
async function approveAs(request: SignableRequest, index: number): Promise<Approval> {
  const response = await fetch('https://api.privy.io/v1/users/me/authorization_signature', {
    method: 'POST',
    headers: {
      'privy-app-id': process.env.PRIVY_APP_ID ?? '',
      Authorization: `Bearer ${DIRECTOR_TOKENS[index]}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ request }),
  });

  if (!response.ok) throw new Error(`Director ${index} could not approve: ${await response.text()}`);

  const { signature, user_id: userId } = (await response.json()) as {
    signature: string;
    user_id: string;
  };
  return { userId, name: `Director ${index}`, signature };
}

describe.skipIf(!FUND_LIVE)("Woodgrove Capital's fund account", () => {
  beforeAll(async () => {
    const held = await balances();
    expect(held.fund).toBeGreaterThan(0n);
  });

  it(`refuses an allocation above $${FUND_CAP_USD.toLocaleString()}`, async () => {
    await allocate({ invoice: 'company', usd: OVER_MANDATE_USD }).then(
      () => expect.unreachable('an over-mandate allocation was signed'),
      (error) => expect(refusedByRule(error)).toMatch(/polic|mandate|denied/i),
    );
  });

  it('refuses an allocation into an invoice that is on no rated list', async () => {
    await allocate({ invoice: UNRATED_INVOICE, usd: WITHIN_MANDATE_USD }).then(
      () => expect.unreachable('an unrated invoice was funded'),
      (error) => expect(refusedByRule(error)).toMatch(/polic|denied/i),
    );
  });

  it('signs an allocation within the mandate into a rated invoice', async () => {
    const sent = await allocate({ invoice: 'company', usd: WITHIN_MANDATE_USD });

    expect(sent.hash).toMatch(/^0x[0-9a-f]+$/i);
  });
});

describe.skipIf(DIRECTOR_TOKENS.length < 2)("Ironline Freight's company account", () => {
  beforeAll(async () => {
    const held = await balances();
    expect(held.company).toBeGreaterThan(0n);
  });

  it('refuses an issuance carrying one approval', async () => {
    const issuance = issuanceToApprove();

    await sendApproved(issuance, [await approveAs(issuance, 0)]).then(
      () => expect.unreachable('one approval issued the notes'),
      (error) => expect(refusedByRule(error)).toMatch(/authoriz|quorum|threshold|signature/i),
    );
  });

  it('issues the notes once a second director approves', async () => {
    const issuance = issuanceToApprove();
    const before = await noteSupply();
    expect(before).toBe(0n);

    const sent = await sendApproved(issuance, [
      await approveAs(issuance, 0),
      await approveAs(issuance, 1),
    ]);

    expect(sent.hash).toMatch(/^0x[0-9a-f]+$/i);
    expect(await noteSupply()).toBe(NOTES_ISSUED);
  });
});

describe.skipIf(!FUND_LIVE)('opening the accounts again', () => {
  it('creates nothing the second time', async () => {
    const first = await openAccounts();
    const second = await openAccounts();

    expect(second.created).toEqual([]);
    expect(second.company.address).toBe(first.company.address);
    expect(second.fund.address).toBe(first.fund.address);
    expect(second.ratedListId).toBe(first.ratedListId);
  });
});
