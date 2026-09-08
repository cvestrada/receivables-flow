import { NextResponse } from 'next/server';
import { allocate } from '@rf/privy/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Asks the fund's account to sign an allocation and reports what it said.
 *
 * A breach of the mandate is not an error here — it is the answer. The provider's
 * own reason is passed back untouched, because a sentence we wrote would read the
 * same whether or not anything had refused.
 */
export async function POST(request: Request) {
  const { usd, invoice } = (await request.json()) as { usd: number; invoice?: string };

  try {
    const sent = await allocate({ invoice: invoice ?? 'company', usd });
    return NextResponse.json({ usd, hash: sent.hash });
  } catch (error) {
    return NextResponse.json({
      usd,
      refusal: error instanceof Error ? error.message : String(error),
    });
  }
}
