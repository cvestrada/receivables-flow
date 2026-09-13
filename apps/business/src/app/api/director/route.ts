import { NextResponse } from 'next/server';
import { openedAccounts, seatVisitingDirector } from '@rf/privy/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Seat whoever just signed in as Ironline Freight's third director.
 *
 * The company wallet takes two signatures of three, and two of those seats are fixed: a
 * director with her own login, and the company's finance system. The third is a quorum of one
 * that the platform can rewrite, so the person in front of the screen becomes a director for
 * as long as they are signed in — which is the difference between a demo somebody watches and
 * one they can run.
 *
 * Seating is deliberately not an approval: it makes the visitor one of the two signatures
 * required, never both.
 */
export async function POST(request: Request) {
  const { userId } = (await request.json()) as { userId?: string };

  if (!userId) {
    return NextResponse.json({ seated: false, reason: 'no user signed in' }, { status: 400 });
  }

  try {
    await seatVisitingDirector(userId);
    const { company } = openedAccounts();

    return NextResponse.json({
      seated: true,
      seat: company.visitingSeatId,
      wallet: company.address,
      /* What the seat is worth, in the wallet's own terms rather than ours. */
      of: 3,
      required: 2,
    });
  } catch (error) {
    /*
     * A refusal here is worth showing rather than swallowing: it is the difference between
     * "you are a director" and "we said you were".
     */
    return NextResponse.json({
      seated: false,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
