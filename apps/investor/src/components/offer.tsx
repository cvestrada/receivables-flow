import { Allocate } from '@/components/allocate';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import type { Offer } from '@/lib/hedera-ats/offer';

const money = (usd: number) => `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/**
 * The one receivable on offer, and the button that funds it.
 *
 * A row, not a table: there is one invoice in this demo, and a table with one row is a table
 * pretending. Under it, the fund's account deciding whether the mandate allows the purchase.
 */
export function Offered({ offer }: { offer?: Offer }) {
  if (!offer) {
    return (
      <Empty className="rounded-xl border bg-[var(--surface)]">
        <EmptyHeader>
          <EmptyTitle>Nothing offered</EmptyTitle>
          <EmptyDescription>A receivable appears here the moment a business tokenizes an invoice.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <section
        data-testid="offer"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-[var(--surface)] px-5 py-4"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-medium text-[var(--ink)]">
            {offer.receivable} · {offer.issuer}
          </span>
          <span className="text-[14px] text-[var(--muted)]">
            {money(offer.faceUsd)} face · {offer.maturityDays} days · credit score{' '}
            {offer.score === null ? 'unrated' : `${offer.score} of 100`}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[19px] font-semibold tabular-nums text-[var(--ink)]">
            {money(offer.priceUsd)}
          </span>
          <span className="text-[13px] text-[var(--muted)]">{offer.feePct.toFixed(2)}% fee</span>
        </div>
      </section>

      <Allocate />
    </>
  );
}
