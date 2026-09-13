import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { INVOICE } from '@rf/shared/invoice';
import {
  issuanceToApprove,
  noteAddress,
  openedAccounts,
  recordApproval,
  sendApproved,
  type Approval,
  type CountedApprovals,
} from '@rf/privy/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = join(process.env.DEMO_STATE_DIR ?? '.', '.approvals.json');

/** What the invoice is worth, written the way a person reads it. */
const FACE_VALUE = `$${INVOICE.faceValueUsd.toLocaleString('en-US')}`;

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
  const issuance = issuanceToApprove();
  try {
    const stored = JSON.parse(readFileSync(STORE, 'utf8')) as CountedApprovals;
    if (JSON.stringify(stored.sale) === JSON.stringify(issuance)) return stored;
  } catch {
    /* Nothing held yet, or held against an issuance that has since changed. */
  }
  return { sale: issuance, approvals: [], required: 2, ready: false };
}

function keep(record: CountedApprovals): CountedApprovals {
  writeFileSync(STORE, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/**
 * Whether the invoice has been submitted for financing.
 *
 * There is nothing to approve until a business has asked for something. The panel used to offer
 * an issuance to approve before anyone had submitted an invoice, which put the company's
 * signature on a request that did not exist.
 */
function submitted(): boolean {
  try {
    return (JSON.parse(readFileSync(join(process.env.DEMO_STATE_DIR ?? '.', '.submitted.json'), 'utf8')) as { submitted?: boolean })
      .submitted === true;
  } catch {
    return false;
  }
}

/** What the portal shows: the issuance on offer, and who has approved it so far. */
function view(record: CountedApprovals) {
  return {
    submitted: submitted(),
    invoice: INVOICE.reference,
    customer: INVOICE.customer,
    amount: FACE_VALUE,
    note: INVOICE.noteTicker,
    noteAddress: noteAddress(),
    issuedTo: openedAccounts().company.address,
    request: record.sale,
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
    invoice: INVOICE.reference,
    customer: INVOICE.customer,
    amount: FACE_VALUE,
    note: INVOICE.noteTicker,
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
    const sent = await sendApproved(record.sale, record.approvals);
    return NextResponse.json({ ...view(record), hash: sent.hash, privy: sent.privy });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    try {
      return NextResponse.json({ ...view(held()), refusal: reason });
    } catch {
      return NextResponse.json(unopened(reason));
    }
  }
}

/**
 * Forget the approvals gathered so far, so the next run starts from nobody having signed.
 *
 * The demo is meant to be repeatable: a judge arriving after someone else has approved would
 * otherwise find the first signature already in place and never see the refusal. Deleting the
 * record changes nothing on any chain — it is a note of who has signed, not a thing anyone
 * signed — which is why it is safe to offer.
 */
export async function DELETE() {
  try {
    unlinkSync(STORE);
  } catch {
    /* Nothing held yet, which is the state this asks for. */
  }

  return NextResponse.json(view(held()));
}
