import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resale, sellHalf, toResale, type ResaleView } from '@/lib/hedera-ats/resale';
import { POST } from './route';

/*
 * The chain lane is replaced, the route is not. What this file checks is the judgement the
 * route makes — who may be offered what, and what it does with the answer that comes back —
 * so the two functions that would reach Hedera are the only things stood in for.
 */
vi.mock('@/lib/hedera-ats/resale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hedera-ats/resale')>();
  return { ...actual, resale: vi.fn(), sellHalf: vi.fn() };
});

const WHOLE = 50_000;
const PRICE = 24_150;

const SELLER = { name: 'Woodgrove Capital', wallet: '0xE1e76C63fb819B35cDC09dbb3D03B3d85eeaE2D8' };
const BUYER = { name: 'Bridgeline Partners', wallet: '0x3F8890000000000000000000000000000000C102' };

/** A wallet nobody has approved, which is what the receivable turns away. */
const NO_PASS = `0x${'B0D3'.repeat(10)}`;

const WHOLLY_OWNED: ResaleView = toResale({ ...SELLER, units: WHOLE }, [{ ...BUYER, units: 0 }], WHOLE, PRICE, true);
const SPLIT: ResaleView = toResale({ ...SELLER, units: 25_000 }, [{ ...BUYER, units: 25_000 }], WHOLE, PRICE, true);

function ask(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/resell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/resell', () => {
  beforeEach(() => {
    vi.mocked(resale).mockReset();
    vi.mocked(sellHalf).mockReset();
  });

  it("an approved buyer's purchase returns the transaction hash of the settled sale", async () => {
    vi.mocked(resale).mockResolvedValueOnce(WHOLLY_OWNED).mockResolvedValueOnce(SPLIT);
    vi.mocked(sellHalf).mockResolvedValue({ hash: '0xfeed', units: 25_000, priceUsd: PRICE });

    const answer = await (await POST(ask({}))).json();

    expect(answer.hash).toBe('0xfeed');
    expect(answer.refusal).toBeUndefined();
  });

  it('the seller keeps the units it did not sell and is still a holder afterwards', async () => {
    vi.mocked(resale).mockResolvedValueOnce(WHOLLY_OWNED).mockResolvedValueOnce(SPLIT);
    vi.mocked(sellHalf).mockResolvedValue({ hash: '0xfeed', units: 25_000, priceUsd: PRICE });

    const answer = await (await POST(ask({}))).json();

    expect(answer.holders[0]).toMatchObject({ name: 'Woodgrove Capital', units: 25_000, sharePct: 50 });
    expect(answer.holders).toHaveLength(2);
  });

  it('offering more units than the seller holds is refused before anything moves', async () => {
    vi.mocked(resale).mockResolvedValue(SPLIT);

    const answer = await (await POST(ask({ units: 40_000 }))).json();

    expect(answer.refusal).toContain('25,000');
    expect(answer.hash).toBeUndefined();
    expect(sellHalf).not.toHaveBeenCalled();
  });

  it("an unapproved buyer is refused, and the chain's own reason is passed back untouched", async () => {
    vi.mocked(resale).mockResolvedValue(WHOLLY_OWNED);
    vi.mocked(sellHalf).mockRejectedValue(new Error('execution reverted: DeliveryLegFailed()'));

    const answer = await (await POST(ask({ buyer: NO_PASS }))).json();

    expect(answer.refusal).toBe('execution reverted: DeliveryLegFailed()');
  });

  it('a refused purchase moves no units and no money', async () => {
    vi.mocked(resale).mockResolvedValue(WHOLLY_OWNED);
    vi.mocked(sellHalf).mockRejectedValue(new Error('execution reverted: DeliveryLegFailed()'));

    const answer = await (await POST(ask({ buyer: NO_PASS }))).json();

    expect(answer.hash).toBeUndefined();
    expect(answer.holders).toHaveLength(1);
    expect(answer.holders[0]).toMatchObject({ name: 'Woodgrove Capital', units: WHOLE, sharePct: 100 });
    expect(answer.cashReturnedUsd).toBe(0);
  });
});
