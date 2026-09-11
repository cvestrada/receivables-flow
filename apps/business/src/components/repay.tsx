'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Quote } from '@/lib/hedera-ats/quote';
import type { Payment, RepaymentView } from '@/lib/hedera-ats/repay';

/** One record on Ironline's page, and what the next invoice costs when priced against it. */
interface Standpoint {
  record: { financed: number; ontime: number; late: number; defaulted: number; score: number | null };
  annualRatePct: number;
  discountUsd: number;
}

/** What the ending did to the public record, and to the price of the next invoice. */
interface Consequence {
  before: Standpoint;
  after: Standpoint;
  published: boolean;
  reason?: string;
}

/** How day 60 ended, as the route reports it back. */
interface Answer {
  outcome: 'repaid' | 'defaulted';
  owedUsd: number;
  holders: Payment[];
  live: boolean;
  settled: boolean;
  reason?: string;
  already: boolean;
  consequence?: Consequence;
}

function money(usd: number): string {
  return `$${Math.round(usd).toLocaleString('en-US')}`;
}

function share(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

/** A score as the page states it, or the honest answer when nothing has matured. */
function score(value: number | null): string {
  return value === null ? 'unrated' : `${value} of 100`;
}

/** How a record reads in words, so nobody has to work out what four numbers mean. */
function tally(record: Standpoint['record']): string {
  return `${record.financed} sold · ${record.ontime} paid on time · ${record.late} paid late · ${record.defaulted} never paid`;
}

function short(wallet: string): string {
  return wallet.startsWith('0x') ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
}

/**
 * How the outcome is introduced, which depends on what actually happened.
 *
 * A repayment that divided correctly but could not sign a transfer, and one that paid every
 * holder on the network, are both repayments — and saying them the same way would hide the
 * difference that matters most to whoever is owed the money.
 */
function headline(answer: Answer): string {
  if (answer.outcome === 'defaulted') return 'RCV-0001 marked defaulted.';
  if (answer.already) return 'Already repaid — day 60 happens once.';
  if (answer.settled) return 'Repaid in full — every holder was paid.';
  return answer.holders.some((holder) => holder.hash)
    ? 'Partly repaid — only the holders with a transaction beside them were paid.'
    : 'Repayment divided, but nothing was transferred.';
}

/**
 * Day 60 on Ironline's screen — the obligation, and the two ways it can end.
 *
 * The sale was made with recourse, so this obligation is Ironline's whether or not Northwind
 * Brokerage has paid Ironline. Nobody holding the receivable claims, signs, or presses
 * anything: the only party acting here is the one that owes, and the division that follows is
 * read off the receivable's own balances rather than from a schedule anyone kept.
 *
 * The unhappy ending is a button rather than a footnote, because a demo that can only show the
 * happy one is not showing what buying a receivable means.
 */
export function Repay({ view, today }: { view: RepaymentView; today: Quote }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);

  async function end(outcome: 'repaid' | 'defaulted') {
    setBusy(true);
    try {
      const response = await fetch('/api/repay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });
      setAnswer((await response.json()) as Answer);
    } finally {
      setBusy(false);
    }
  }

  async function startOver() {
    setBusy(true);
    try {
      await fetch('/api/repay', { method: 'DELETE' });
      setAnswer(null);
    } finally {
      setBusy(false);
    }
  }

  const holders = answer?.holders ?? view.holders;
  const repaid = answer?.outcome === 'repaid';

  /*
   * What the record said before the ending comes from the quote this page was rendered with
   * until an ending has been pressed, and from the ending itself afterwards — the route reads
   * the page immediately before writing to it, which is the only reading that can be compared
   * with what it says after.
   */
  const consequence = answer?.consequence;
  const before: Standpoint = consequence?.before ?? {
    record: today.record,
    annualRatePct: today.annualRatePct,
    discountUsd: today.discountUsd,
  };
  const after = consequence?.after;
  const movement = !after
    ? ''
    : after.discountUsd < before.discountUsd
      ? 'The next invoice costs less to sell than it did this morning'
      : after.discountUsd > before.discountUsd
        ? 'The next invoice costs more to sell than it did this morning'
        : 'The next invoice costs the same as it did this morning';

  return (
    <section
      aria-label="Repay RCV-0001 at maturity"
      className="overflow-hidden rounded-xl border bg-[var(--surface)]"
    >
      <header className="border-b px-5 py-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Day 60 — RCV-0001 falls due</h2>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]">
          The receivable was sold <b>with recourse</b>, so the obligation is Ironline’s at face
          value — owed whether or not Northwind Brokerage has paid Ironline.
        </p>
      </header>

      <p data-testid="repay-owed" className="border-b px-5 py-3 text-[14px] text-[var(--body)]">
        <b>Owed at maturity:</b> {money(view.owedUsd)} — divided across{' '}
        {holders.length === 1 ? 'the one holder' : `all ${holders.length} holders`} of RCV-0001, in
        proportion to what each holds.
      </p>

      <div className="flex flex-wrap gap-2.5 px-5 py-4">
        <Button onClick={() => end('repaid')} disabled={busy}>
          Repay {money(view.owedUsd)}
        </Button>
        <Button variant="outline" onClick={() => end('defaulted')} disabled={busy}>
          Do not repay
        </Button>
        <Button
          data-testid="repay-start-over"
          variant="ghost"
          onClick={startOver}
          disabled={busy}
        >
          Start over
        </Button>
      </div>

      <div className="border-t px-5 py-4">
        <div className="eyebrow mb-2">
          {repaid ? 'Who was paid what' : 'Who holds RCV-0001, and what each is owed'}
        </div>
        <table data-testid="repay-holders" className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="pb-1.5 font-medium">Holder</th>
              <th className="pb-1.5 font-medium">Wallet</th>
              <th className="pb-1.5 text-right font-medium">Holds</th>
              <th className="pb-1.5 text-right font-medium">Share</th>
              <th className="pb-1.5 text-right font-medium">
                {answer?.outcome === 'defaulted' ? 'Lost' : 'Paid'}
              </th>
            </tr>
          </thead>
          <tbody>
            {holders.map((holder) => (
              <tr key={holder.wallet} data-testid="repay-holder" className="border-t">
                <td className="py-1.5 text-[var(--ink)]">{holder.name}</td>
                <td className="py-1.5 tabular-nums text-[var(--muted)]">{short(holder.wallet)}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {holder.units.toLocaleString('en-US')} units
                </td>
                <td
                  data-testid="repay-holder-share"
                  className="py-1.5 text-right tabular-nums text-[var(--ink)]"
                >
                  {share(holder.sharePct)}
                </td>
                {/*
                  * A default has no paid column at all rather than a column of noughts. Nothing
                  * was divided up to pay with, and a nought reads as an amount that was worked
                  * out and then withheld.
                  */}
                {answer?.outcome === 'defaulted' ? (
                  <td
                    data-testid="repay-holder-lost"
                    className="py-1.5 text-right tabular-nums text-[var(--neg)]"
                  >
                    −{money(holder.owedUsd)}
                  </td>
                ) : !answer ? (
                  <td
                    data-testid="repay-holder-owed"
                    className="py-1.5 text-right tabular-nums text-[var(--muted)]"
                  >
                    {money(holder.owedUsd)}
                  </td>
                ) : holder.hash ? (
                  <td className="py-1.5 text-right tabular-nums text-[var(--pos)]">
                    <span data-testid="repay-holder-paid">{money(holder.paidUsd)}</span>
                    <a
                      data-testid="repay-holder-hash"
                      href={`https://hashscan.io/testnet/transaction/${holder.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-[12px] font-normal text-[var(--muted)] underline"
                    >
                      {short(holder.hash)}
                    </a>
                  </td>
                ) : (
                  /*
                    * No transaction, so no amount. What a holder is owed and what reached it are
                    * two different facts, and printing the first under a column headed "paid" is
                    * the exact claim this panel used to make while no money could move at all.
                    */
                  <td
                    data-testid="repay-holder-unpaid"
                    className="py-1.5 text-right tabular-nums text-[var(--muted)]"
                  >
                    not paid
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/*
          * Where these figures came from, said beside them. A division the portal could not
          * refresh is still worth showing, but a business has to be able to tell it apart from
          * one that is current.
          */}
        {/*
          * What the money is, said where the amounts are. Circle's USDC faucet gives twenty
          * dollars per address every two hours, so a $50,000 repayment could never be funded
          * with it — and a mock has to be named as one, or the screen is claiming settlement
          * in a currency it never touched.
          */}
        <p data-testid="repay-money" className="mt-2 text-[13px] text-[var(--muted)]">
          Paid in <b>mUSDC</b>, mock USDC this repository deploys on Hedera testnet — not
          Circle’s own USDC, whose testnet faucet gives $20 per address every two hours and could
          never fund a $50,000 repayment. Anyone may deposit it, so Ironline tops its account up
          to what it owes before paying. Six decimals, so no figure above changed with the money.
        </p>

        <p className="mt-2 text-[13px] text-[var(--muted)]">
          {view.live
            ? 'Shares read from the receivable on Hedera testnet — the units held are the chain’s figures, not ours.'
            : 'Not live — the balances on hand, shown because the Hedera endpoint could not be reached. Nothing here was typed into the page.'}
        </p>
      </div>

      <div data-testid="outcome-record" className="border-t px-5 py-4">
        <div className="eyebrow mb-2">What this does to Ironline’s public record</div>

        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="pb-1.5 font-medium">On ironline.business.receivablesflow.eth</th>
              <th className="pb-1.5 text-right font-medium">Before day 60</th>
              <th className="pb-1.5 text-right font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-1.5 text-[var(--ink)]">Invoices</td>
              <td className="py-1.5 text-right text-[var(--muted)]">{tally(before.record)}</td>
              <td className="py-1.5 text-right text-[var(--ink)]">
                {after ? tally(after.record) : '—'}
              </td>
            </tr>
            <tr className="border-t">
              <td className="py-1.5 text-[var(--ink)]">Credit score</td>
              <td
                data-testid="outcome-score-before"
                className="py-1.5 text-right tabular-nums text-[var(--muted)]"
              >
                {score(before.record.score)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-[var(--ink)]">
                {after ? (
                  <span data-testid="outcome-score-after">{score(after.record.score)}</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
            <tr className="border-t">
              <td className="py-1.5 text-[var(--ink)]">Rate the next invoice earns</td>
              <td className="py-1.5 text-right tabular-nums text-[var(--muted)]">
                {before.annualRatePct.toFixed(2)}%
              </td>
              <td className="py-1.5 text-right tabular-nums text-[var(--ink)]">
                {after ? `${after.annualRatePct.toFixed(2)}%` : '—'}
              </td>
            </tr>
            <tr className="border-t">
              <td className="py-1.5 text-[var(--ink)]">Cost of selling the next invoice</td>
              <td
                data-testid="outcome-discount-before"
                className="py-1.5 text-right tabular-nums text-[var(--muted)]"
              >
                {money(before.discountUsd)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-[var(--ink)]">
                {after ? (
                  <span data-testid="outcome-discount-after">{money(after.discountUsd)}</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/*
          * Whether the world can see this yet, said beside it. A tally worked out here and a
          * tally published on the page are different facts, and the second is the one that
          * earns Ironline a cheaper invoice next time.
          */}
        <p data-testid="outcome-published" className="mt-2 text-[13px] text-[var(--muted)]">
          {!after
            ? 'Not published yet — day 60 has not ended. The record above is what any funder reads today.'
            : consequence?.published
              ? `Published to Ironline’s page on Sepolia. ${movement} — nobody at Receivables Flow chose that; it is the same formula run against one more invoice.`
              : `Not published — ${consequence?.reason ?? 'the page could not be written to.'} ${movement} once it is.`}
        </p>
      </div>

      {answer && (
        <div
          data-testid="repay-outcome"
          className={`border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed ${
            answer.outcome === 'defaulted' ? 'text-[var(--neg)]' : 'text-[var(--pos)]'
          }`}
        >
          <b>{headline(answer)}</b>{' '}
          {answer.outcome === 'defaulted'
            ? 'Nobody was paid. Each holder is out its own share of the $50,000 — the same proportion it would have been paid in.'
            : 'No holder claimed, signed, or pressed anything. The only party that acted is the one that owed.'}{' '}
          {answer.reason && <span data-testid="repay-reason">{answer.reason}</span>}
        </div>
      )}
    </section>
  );
}
