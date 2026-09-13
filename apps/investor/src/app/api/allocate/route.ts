import { NextResponse } from 'next/server';
import { allocate } from '@rf/privy/accounts';
import { settlePrimarySale } from '@rf/privy/demo';

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

    /*
     * Money first, units second — the two legs of a settlement in the order a settlement runs
     * them. The fund's account has signed the payment; the receivable now moves to the fund.
     * Only for the purchase that fits: a payment the mandate refused has no delivery leg.
     */
    const delivered = invoice ? undefined : await settlePrimarySale();

    return NextResponse.json({ usd, hash: sent.hash, delivered });
  } catch (error) {
    return NextResponse.json({
      usd,
      refusal: error instanceof Error ? error.message : String(error),
    });
  }
}
