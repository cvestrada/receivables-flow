import { describe, it, expect } from 'vitest';
import {
  APPROVER_COUNT,
  APPROVERS_REQUIRED,
  FUND_CAP_USD,
  USD_PER_HBAR,
  buildApprovingGroup,
  buildAllocationRequest,
  buildFundPolicy,
  buildSaleRequest,
  usdToWeibar,
} from '../src/policies';

const RATED_LIST_ID = 'qvah5m2hmp9abqlxdmfiht95';

function fundRules() {
  return buildFundPolicy(RATED_LIST_ID).rules;
}

describe('the approving group', () => {
  it('requires two of three', () => {
    const group = buildApprovingGroup(['director-a', 'director-b', 'director-c']);

    expect(group.user_ids).toHaveLength(APPROVER_COUNT);
    expect(group.authorization_threshold).toBe(APPROVERS_REQUIRED);
    expect(APPROVERS_REQUIRED).toBe(2);
    expect(APPROVER_COUNT).toBe(3);
  });
});

describe("the fund's rule", () => {
  it('caps a purchase at $100,000', () => {
    const cap = usdToWeibar(FUND_CAP_USD);

    const allow = fundRules().find((rule) => rule.action === 'ALLOW');
    const amount = allow?.conditions.find((condition) => condition.field === 'value');
    expect(amount).toEqual(
      expect.objectContaining({ operator: 'lte', value: cap.toString() }),
    );

    const deny = fundRules().find((rule) => rule.action === 'DENY');
    const overCap = deny?.conditions.find((condition) => condition.field === 'value');
    expect(overCap).toEqual(
      expect.objectContaining({ operator: 'gt', value: cap.toString() }),
    );

    expect(FUND_CAP_USD).toBe(100_000);
  });

  it('demands membership of the rated list', () => {
    const allow = fundRules().find((rule) => rule.action === 'ALLOW');
    const recipient = allow?.conditions.find((condition) => condition.field === 'to');

    expect(recipient).toEqual(
      expect.objectContaining({ operator: 'in_condition_set', value: RATED_LIST_ID }),
    );
  });

  it('refuses anything it does not explicitly allow', () => {
    const rules = fundRules();

    expect(rules.some((rule) => (rule.method as string) === '*')).toBe(false);
    expect(
      rules.some((rule) => rule.action === 'ALLOW' && rule.conditions.length === 0),
    ).toBe(false);
    expect(rules.filter((rule) => rule.action === 'ALLOW')).toHaveLength(1);
  });
});

describe('amounts', () => {
  it('converts dollars to chain amounts at one HBAR per $10,000', () => {
    expect(USD_PER_HBAR).toBe(10_000);
    expect(usdToWeibar(100_000)).toBe(10n * 10n ** 18n);
    expect(usdToWeibar(50_000)).toBe(5n * 10n ** 18n);
  });
});

describe('the request a director signs', () => {
  const sale = {
    appId: 'app-1',
    walletId: 'wallet-1',
    invoiceId: 'INV-2026-0417',
    buyer: `0x${'1'.repeat(40)}`,
  };

  it('is byte-identical for every director approving one sale', () => {
    const first = JSON.stringify(buildSaleRequest(sale));
    const second = JSON.stringify(buildSaleRequest(sale));

    expect(first).toBe(second);
  });

  it('differs once the invoice differs', () => {
    const other = JSON.stringify(buildSaleRequest({ ...sale, invoiceId: 'INV-2026-0418' }));

    expect(other).not.toBe(JSON.stringify(buildSaleRequest(sale)));
  });
});

describe('the request the fund signs', () => {
  it('carries the stated dollars at the published rate', () => {
    const invoice = `0x${'2'.repeat(40)}`;
    const request = buildAllocationRequest({
      appId: 'app-1',
      walletId: 'wallet-2',
      invoice,
      usd: 47_500,
    });

    expect(request.body.params.transaction.to).toBe(invoice);
    expect(BigInt(request.body.params.transaction.value)).toBe(usdToWeibar(47_500));
  });
});
