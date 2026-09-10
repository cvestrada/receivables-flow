import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { IMint__factory } from '@hashgraph/asset-tokenization-contracts';
import { INVOICE } from '@rf/shared/invoice';
import { MINT_SELECTOR, buildIssuanceRequest, notesForFaceValue } from '../src/policies';
import { issuanceToApprove } from '../src/accounts';

const NOTE = `0x${'a'.repeat(40)}`;
const IRONLINE = `0x${'b'.repeat(40)}`;

const ISSUANCE = {
  appId: 'app-1',
  walletId: 'wallet-1',
  note: NOTE,
  to: IRONLINE,
  faceValueUsd: 50_000,
};

/*
 * The call is written by hand in `policies.ts`, so the test takes it apart by hand
 * too. Decoding it with the same helper that wrote it would prove only that the
 * helper is its own inverse.
 */
function mintCall(data: string): { selector: string; to: string; amount: bigint } {
  const body = data.slice(10);
  return {
    selector: data.slice(0, 10),
    to: `0x${body.slice(24, 64)}`,
    amount: BigInt(`0x${body.slice(64, 128)}`),
  };
}

describe('the issuance a director signs', () => {
  it('is byte-identical every time it is built', () => {
    const first = JSON.stringify(buildIssuanceRequest(ISSUANCE));
    const second = JSON.stringify(buildIssuanceRequest(ISSUANCE));

    expect(first).toBe(second);
  });

  it('is addressed to the note itself and moves no money of its own', () => {
    const { transaction } = buildIssuanceRequest(ISSUANCE).body.params;

    expect(transaction.to).toBe(NOTE);
    expect(BigInt(transaction.value)).toBe(0n);
  });

  it("hands the notes to Ironline Freight's shared account", () => {
    const call = mintCall(buildIssuanceRequest(ISSUANCE).body.params.transaction.data);

    expect(call.to.toLowerCase()).toBe(IRONLINE.toLowerCase());
    expect(call.amount).toBe(notesForFaceValue(50_000));
  });

  it('calls the mint entry point the deployed note actually exposes', () => {
    const mint = IMint__factory.createInterface().getFunction('mint');
    const deployed = mint.selector;

    expect(mint.format('sighash')).toBe('mint(address,uint256)');

    expect(MINT_SELECTOR).toBe(deployed);
    expect(mintCall(buildIssuanceRequest(ISSUANCE).body.params.transaction.data).selector).toBe(
      deployed,
    );
  });

  it('differs once the note or the amount differs', () => {
    const same = JSON.stringify(buildIssuanceRequest(ISSUANCE));
    const otherNote = JSON.stringify(
      buildIssuanceRequest({ ...ISSUANCE, note: `0x${'c'.repeat(40)}` }),
    );
    const otherAmount = JSON.stringify(buildIssuanceRequest({ ...ISSUANCE, faceValueUsd: 40_000 }));

    expect(otherNote).not.toBe(same);
    expect(otherAmount).not.toBe(same);
  });
});

describe('face value as notes', () => {
  it('issues one note per dollar in the note six decimals', () => {
    expect(notesForFaceValue(50_000)).toBe(50_000n * 10n ** 6n);
  });

  it('issues exactly one note for a one dollar invoice', () => {
    expect(notesForFaceValue(1)).toBe(10n ** 6n);
  });
});

describe('the issuance the portal offers', () => {
  /*
   * The accounts file is written by provisioning against a live Privy app, so it is
   * absent on any machine that has not run it. A stand-in placed where the real one
   * would be lets this test read the same path the portal reads.
   */
  beforeAll(() => {
    const directory = mkdtempSync(join(tmpdir(), 'rf-accounts-'));
    const path = join(directory, 'accounts.json');
    writeFileSync(
      path,
      JSON.stringify({
        company: { address: IRONLINE, walletId: 'wallet-1', quorumId: 'quorum-1', directors: [] },
        fund: { address: `0x${'d'.repeat(40)}`, walletId: 'wallet-2', policyId: 'policy-1' },
        ratedListId: 'rated-1',
        created: [],
      }),
    );
    process.env.PRIVY_ACCOUNTS_JSON_PATH = path;
    process.env.PRIVY_APP_ID = 'app-1';
  });

  it('carries the face value recorded against the invoice, not a number beside it', () => {
    const call = mintCall(issuanceToApprove().body.params.transaction.data);

    expect(INVOICE.reference).toBe('INV-2026-0417');
    expect(call.amount).toBe(notesForFaceValue(INVOICE.faceValueUsd));
    expect(call.to.toLowerCase()).toBe(IRONLINE.toLowerCase());
  });
});
