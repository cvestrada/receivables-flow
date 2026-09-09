import { quote } from '@/lib/hedera-ats/quote';

const money = (usd: number) =>
  `$${usd.toLocaleString('en-US', { minimumFractionDigits: usd % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

/** One line of the working, so the price reads as a sum rather than a claim. */
function Step({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <span className="text-[15px] text-[var(--body)]">
        {label}
        {note ? <span className="ml-2 text-[14px] text-[var(--muted)]">{note}</span> : null}
      </span>
      <span className="text-[15px] font-medium tabular-nums text-[var(--ink)]">{value}</span>
    </div>
  );
}

/**
 * What this invoice sells for, and the working behind it.
 *
 * Read from the chain on every request rather than written into the page. The counts come off
 * Ironline Freight's public profile, the score is one division over them, and the price falls
 * out of the score and the invoice's own terms — so an investor who disputes the number can
 * run the same three steps themselves instead of taking the portal's word for it.
 */
export async function Quote() {
  const { record, faceValueUsd, maturityDays, annualRatePct, discountUsd, proceedsUsd } = await quote();
  const matured = record.repaid + record.defaulted;

  return (
    <section className="desk overflow-hidden border-[var(--accent)]" data-testid="quote">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h3 className="text-[16px] font-semibold text-[var(--ink)]">
          What INV-2026-0417 sells for today
        </h3>
        <span className="st st-ok">read from the chain</span>
      </div>

      <div className="divide-y">
        <Step
          label="Repayment record"
          note={`${record.financed} financed · ${record.repaid} repaid · ${record.defaulted} missed`}
          value={
            record.score === null
              ? 'unrated'
              : `${record.repaid} of ${matured} matured invoices paid`
          }
        />
        <Step
          label="Credit score"
          note="repaid ÷ matured, out of 100"
          value={record.score === null ? 'unrated — priced at the bottom' : `${record.score} / 100`}
        />
        <Step label="Rate this record earns" note="a year, on a 360-day year" value={`${annualRatePct.toFixed(2)}%`} />
        <Step label="Face value" note={`payable in ${maturityDays} days`} value={money(faceValueUsd)} />
        <Step label="Discount the investor keeps" value={`− ${money(discountUsd)}`} />
      </div>

      <div className="flex items-baseline justify-between gap-4 border-t bg-[var(--surface-alt)] px-5 py-4">
        <span className="text-[16px] font-semibold text-[var(--ink)]">You receive today</span>
        <span
          className="text-[22px] font-semibold tabular-nums text-[var(--ink)]"
          data-testid="quote-proceeds"
        >
          {money(proceedsUsd)}
        </span>
      </div>

      <div className="panel-note border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--muted)]">
        Nobody sets this price. It is the invoice&rsquo;s own terms and the record on{' '}
        <b>ironline.business.receivablesflow.eth</b>, which anyone can read. Pay this invoice on time and
        the score rises, so the next one costs less — miss it and the next one costs more.
      </div>
    </section>
  );
}

/**
 * The repayment the network is holding until day 60.
 *
 * Shown beside the price because the two are the same promise from opposite ends: the discount
 * is what the investor is owed, and this is the instruction that pays it. It is created inside
 * the sale itself, so there is no moment where the invoice has been sold and nothing is due
 * back.
 */
export async function BookedRepayment() {
  const { maturityDays, faceValueUsd } = await quote();
  const due = new Date(Date.now() + maturityDays * 86_400_000).toISOString().slice(0, 10);

  return (
    <section className="desk overflow-hidden" data-testid="booked-repayment">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h3 className="text-[16px] font-semibold text-[var(--ink)]">The day-60 repayment</h3>
        <span className="st st-hot">booked with the sale</span>
      </div>

      <div className="divide-y">
        <Step label="Amount due to the holder" value={money(faceValueUsd)} />
        <Step label="Runs on" note={`${maturityDays} days after the money moves`} value={due} />
        <Step label="Booked by" note="in the same transaction as the sale" value="Hedera schedule service" />
      </div>

      <div className="panel-note border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--muted)]">
        Nobody at Receivables Flow has to remember day 60. The network is holding the instruction, and
        if it will not accept the booking then the sale itself does not happen.
      </div>
    </section>
  );
}
