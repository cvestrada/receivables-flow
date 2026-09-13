import { NextResponse } from 'next/server';
import { recordFinanced } from '@/lib/ens/outcome';
import {
  forgetSubmission,
  invoiceView,
  readSubmission,
  statusOf,
  writeSubmission,
  type Submission,
} from '@/lib/submission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function answer(held: Submission) {
  return { status: statusOf(held), hash: held.hash, at: held.at, invoice: invoiceView() };
}

export async function GET() {
  return NextResponse.json(answer(readSubmission()));
}

/**
 * Move the invoice on one state.
 *
 * `request` is the business asking; `tokenized` is the mint that followed two signatures. Both
 * are idempotent — asking twice is the same request, and recording the same mint twice is the
 * same receivable — because a demo gets clicked twice.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: 'request' | 'tokenized';
    hash?: string;
  };

  const held = readSubmission();

  if (body.action === 'tokenized') {
    if (!body.hash) return NextResponse.json({ error: 'no transaction' }, { status: 400 });

    /*
     * The first time only. A mint is recorded once, and the count on Ironline's page has to
     * move exactly once with it — recording the same mint again is the same receivable, not a
     * second invoice financed.
     */
    const first = !held.hash;

    const recorded = writeSubmission({
      ...held,
      submitted: true,
      at: held.at ?? new Date().toISOString(),
      hash: held.hash ?? body.hash,
      tokenizedAt: held.tokenizedAt ?? new Date().toISOString(),
    });

    const counted = first ? await recordFinanced() : undefined;

    return NextResponse.json({ ...answer(recorded), counted });
  }

  return NextResponse.json(
    answer(
      held.submitted ? held : writeSubmission({ submitted: true, at: new Date().toISOString() }),
    ),
  );
}

/** Forget it, so the demo starts from an invoice nobody has submitted. */
export async function DELETE() {
  forgetSubmission();
  return NextResponse.json(answer({ submitted: false }));
}
