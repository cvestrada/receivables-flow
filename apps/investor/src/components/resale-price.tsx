import type { Leg, ResaleQuote } from '@/lib/hedera-ats/resale-quote';

const money = (usd: number) =>
  `$${usd.toLocaleString('en-US', { minimumFractionDigits: usd % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

const rate = (pct: number) => `${pct.toFixed(2)}%`;

/** One quote, read as a row: what was priced, over how long, at what rate, for how much. */
function Row({
  label,
  leg,
  note,
  testid,
  strong,
}: {
  label: string;
  leg: Leg;
  note: string;
  testid?: string;
  strong?: boolean;
}) {
  return (
    <tr className="border-t" data-testid={testid}>
      <td className="py-2 pr-3 text-[var(--ink)]">
        {label}
        <span className="mt-0.5 block text-[13px] text-[var(--muted)]">{note}</span>
      </td>
      <td className="py-2 text-right tabular-nums text-[var(--ink)]">
        {leg.score === null ? 'unrated' : `${leg.score} / 100`}
      </td>
      <td className="py-2 text-right tabular-nums text-[var(--ink)]">{rate(leg.annualRatePct)}</td>
      <td
        className={`py-2 text-right tabular-nums ${strong ? 'font-semibold text-[var(--ink)]' : 'text-[var(--body)]'}`}
      >
        {money(leg.priceUsd)}
      </td>
    </tr>
  );
}

/**
 * What half of RCV-0001 is worth today, and why that is not the rate the invoice was funded at.
 *
 * The resale is quoted rather than matched. There is no book to trade an invoice into — no
 * second $50,000 Ironline receivable maturing on the same day — so the venue publishes a price
 * with its working attached and the buyer takes it or walks. The working is the point: the same
 * formula that priced the invoice on day 0, run again on the record as it stands now and on the
 * forty days that are actually left.
 *
 * The third row is what the rating is worth in money. A fund reading the first two rows alone
 * would see a smaller number and put it down to the clock; priced beside a record carrying one
 * late payment, the part the score is doing has a figure on it.
 */
export function ResalePrice({ quote }: { quote: ResaleQuote }) {
  const { dayZero, today, ifLate } = quote;
  const costOfLate = today.priceUsd - ifLate.priceUsd;

  return (
    <section className="overflow-hidden rounded-xl border bg-[var(--surface)]" data-testid="resale-price">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">
            What half the position sells for on day 20
          </h2>
          <p className="mt-0.5 text-[14px] text-[var(--muted)]">
            Priced off Ironline Freight&rsquo;s record, not off what the fund would like for it.
          </p>
        </div>
        <span className={`st ${quote.live ? 'st-ok' : ''}`}>
          {quote.live ? 'read from the chain' : 'not live'}
        </span>
      </header>

      <div className="px-5 py-3">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="pb-1.5 font-medium">Priced</th>
              <th className="pb-1.5 text-right font-medium">Credit score</th>
              <th className="pb-1.5 text-right font-medium">Rate a year</th>
              <th className="pb-1.5 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="Day 0 — the whole invoice"
              note={`${money(dayZero.faceUsd)} payable in ${dayZero.days} days`}
              leg={dayZero}
              testid="resale-price-day-zero"
            />
            <Row
              label="Day 20 — half the position"
              note={`${money(today.faceUsd)} payable in ${today.days} days`}
              leg={today}
              testid="resale-price-today"
              strong
            />
            <Row
              label="Day 20 — if Ironline had paid one invoice late"
              note="six paid on time, one paid late"
              leg={ifLate}
              testid="resale-price-if-late"
            />
          </tbody>
        </table>
      </div>

      <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--muted)]">
        Two things move the day-20 price: forty days of carry instead of sixty, and Ironline&rsquo;s
        record. The second is worth{' '}
        <b data-testid="resale-price-cost-of-late">{money(costOfLate)}</b> on this position alone —
        that is what one late payment costs a business, in a number, before anybody negotiates.
        Nothing here is a grade we assigned: the counts are on{' '}
        <b>ironline.business.receivablesflow.eth</b> and the formula is one line anyone can rerun.
      </div>
    </section>
  );
}
