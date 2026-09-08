import { describe, expect, it } from 'vitest';
import { APPROVERS_REQUIRED, buildSaleRequest } from '../src/policies';
import { recordApproval } from '../src/accounts';

const SALE = buildSaleRequest({
  appId: 'app-1',
  walletId: 'wallet-1',
  invoiceId: 'INV-2026-0417',
  buyer: `0x${'1'.repeat(40)}`,
});

const ANNA = { userId: 'did:privy:anna', name: 'Anna Reed', signature: 'sig-anna' };
const TOM = { userId: 'did:privy:tom', name: 'Tom Hill', signature: 'sig-tom' };

describe('the approval record', () => {
  it('leaves the sale at one of two after the first director approves', () => {
    const record = recordApproval({ sale: SALE, approvals: [] }, ANNA);

    expect(record.approvals).toHaveLength(1);
    expect(record.required).toBe(APPROVERS_REQUIRED);
    expect(record.ready).toBe(false);
  });

  it('counts one director approving twice as one approval', () => {
    const once = recordApproval({ sale: SALE, approvals: [] }, ANNA);
    const twice = recordApproval(once, { ...ANNA, signature: 'sig-anna-again' });

    expect(twice.approvals).toHaveLength(1);
    expect(twice.approvals[0].signature).toBe('sig-anna-again');
    expect(twice.ready).toBe(false);
  });

  it('brings the sale to two of two when a second director approves', () => {
    const record = recordApproval(recordApproval({ sale: SALE, approvals: [] }, ANNA), TOM);

    expect(record.approvals.map((a) => a.signature)).toEqual(['sig-anna', 'sig-tom']);
    expect(record.ready).toBe(true);
  });
});
