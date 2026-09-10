import { NextResponse } from 'next/server';
import { SECOND_INVESTOR, resale, sellHalf, type HolderView } from '@/lib/hedera-ats/resale';
import { resaleQuote } from '@/lib/hedera-ats/resale-quote';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What the fund's screen gets back from one attempt to sell part of the position. */
export interface ResaleAnswer {
  buyer: string;
  units: number;
  hash?: string;
  refusal?: string;
  /** Who holds the receivable now, read back after the attempt either way. */
  holders: HolderView[];
  cashReturnedUsd: number;
  live: boolean;
}

/**
 * Sells part of the fund's position and reports what the chain said.
 *
 * A refused purchase is not an error here — it is the answer, and the reason is passed back
 * word for word. A sentence we wrote would read the same whether or not the receivable had
 * actually turned the buyer away.
 *
 * The split is read back afterwards in both cases. That is what makes a refusal legible: the
 * screen can show that nothing moved rather than assert it.
 */
export async function POST(request: Request) {
  const { buyer, units } = (await request.json()) as { buyer?: string; units?: number };
  const wallet = buyer ?? SECOND_INVESTOR.wallet;

  /*
   * The price is worked out before anything is offered, from Ironline's record as it stands
   * on this request. A price fixed when the demo was written would go on being asked long
   * after the record it was justified by had moved.
   */
  const { today } = await resaleQuote();
  const before = await resale(today.priceUsd);
  const seller = before.holders[0];
  const offered = units ?? Math.floor(before.wholeUnits / 2);

  /*
   * A holder may only offer units it actually holds. Checked before anything is signed, so an
   * offer nobody could ever settle is never listed in the first place.
   */
  if (!seller || offered > seller.units) {
    return NextResponse.json({
      buyer: wallet,
      units: offered,
      refusal: `Woodgrove Capital holds ${seller ? seller.units.toLocaleString('en-US') : '0'} units and cannot offer ${offered.toLocaleString('en-US')}.`,
      holders: before.holders,
      cashReturnedUsd: before.cashReturnedUsd,
      live: before.live,
    } satisfies ResaleAnswer);
  }

  try {
    const sale = await sellHalf(wallet, offered, today.priceUsd);
    const after = await resale(today.priceUsd);

    return NextResponse.json({
      buyer: wallet,
      units: sale.units,
      hash: sale.hash,
      holders: after.holders,
      cashReturnedUsd: after.cashReturnedUsd,
      live: after.live,
    } satisfies ResaleAnswer);
  } catch (error) {
    return NextResponse.json({
      buyer: wallet,
      units: offered,
      refusal: error instanceof Error ? error.message : String(error),
      holders: before.holders,
      cashReturnedUsd: before.cashReturnedUsd,
      live: before.live,
    } satisfies ResaleAnswer);
  }
}
