import { readFileSync, writeFileSync } from 'node:fs';
import { NextResponse } from 'next/server';
import {
  openedAccounts,
  recordApproval,
  saleToApprove,
  sendSale,
  type Approval,
  type CountedApprovals,
} from '@rf/privy/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVOICE = 'INV-2026-0417';
const AMOUNT = '$47,500';
const STORE = '.approvals.json';

/*
 * Where the first approval waits for the second.
 *
 * Two directors approve hours apart from two different browsers, so the first
 * signature has to outlive the request that carried it. A file is enough: this
 * holds nothing secret — a signature is worthless without the sale it was taken
 * over — and it survives the dev server reloading between the two approvals,
 * which memory would not.
 */
function held(): CountedApprovals {
  const sale = saleToApprove(INVOICE);
  try {
    const stored = JSON.parse(readFileSync(STORE, 'utf8')) as CountedApprovals;
    if (JSON.stringify(stored.sale) === JSON.stringify(sale)) return stored;
  } catch {
    /* Nothing held yet, or held against a sale that has since changed. */
  }
  return { sale, approvals: [], required: 2, ready: false };
}

function keep(record: CountedApprovals): CountedApprovals {
  writeFileSync(STORE, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/** What the portal shows: the sale on offer, and who has approved it so far. */
function view(record: CountedApprovals) {
  return {
    invoice: INVOICE,
    amount: AMOUNT,
    buyer: openedAccounts().fund.address,
    sale: record.sale,
    approvals: record.approvals.map(({ userId, name }) => ({ userId, name })),
    required: record.required,
    ready: record.ready,
  };
}

/*
 * What the portal shows before the accounts exist.
 *
 * The section still renders — the invoice, the counter, the two buttons — with the
 * one thing that is missing named. A section that vanished until provisioning had
 * run would leave the person looking at it unable to tell a missing account from a
 * missing feature.
 */
function unopened(reason: string) {
  return {
    invoice: INVOICE,
    amount: AMOUNT,
    approvals: [],
    required: 2,
    ready: false,
    unopened: reason,
  };
}

export async function GET() {
  try {
    return NextResponse.json(view(held()));
  } catch (error) {
    return NextResponse.json(unopened(error instanceof Error ? error.message : String(error)));
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action: 'approve' | 'send'; approval?: Approval };

  try {
    if (body.action === 'approve') {
      if (!body.approval) return NextResponse.json({ error: 'no approval' }, { status: 400 });
      return NextResponse.json(view(keep(recordApproval(held(), body.approval))));
    }
  } catch (error) {
    return NextResponse.json(unopened(error instanceof Error ? error.message : String(error)));
  }

  /*
   * Sends whatever approvals exist, including too few. That is the point: the
   * refusal has to come from Privy counting signatures rather than from this
   * handler declining to ask, and a handler that refused first would be exactly
   * the control-in-our-code the account exists to replace.
   */
  try {
    const record = held();
    const sent = await sendSale(record.sale, record.approvals);
    return NextResponse.json({ ...view(record), hash: sent.hash });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    try {
      return NextResponse.json({ ...view(held()), refusal: reason });
    } catch {
      return NextResponse.json(unopened(reason));
    }
  }
}
