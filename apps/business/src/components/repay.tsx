'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { describeRecord } from '@rf/contracts-ens';
import deployed from '@rf/contracts-ens/deployed.json';
import { Button } from '@/components/ui/button';
import type { Quote } from '@/lib/hedera-ats/quote';
import type { Payment, RepaymentView } from '@/lib/hedera-ats/repay';

/** The name the record lives under, taken from what onboarding actually registered. */
const ENS_NAME =
  (deployed as { business?: { name: string } }).business?.name ??
  'ironline.business.receivablesflow.eth';

/** One record on Ironline's page, and what the next invoice costs when priced against it. */
interface Standpoint {
  record: { financed: number; ontime: number; late: number; defaulted: number; score: number | null };
  dailyRatePct: number;
  feePct: number;
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
  return describeRecord(record);
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
    dailyRatePct: today.dailyRatePct,
    feePct: today.feePct,
    discountUsd: today.discountUsd,
  };
  const after = consequence?.after;
  const movement = !after
    ? ''
    : after.discountUsd < before.discountUsd
      ? 'Your next invoice is cheaper'
      : after.discountUsd > before.discountUsd
        ? 'Your next invoice costs more'
        : 'Your next invoice costs the same';

  return (
    <section
      aria-label="Repay RCV-0001 at maturity"
      className="overflow-hidden rounded-xl border bg-[var(--surface)]"
    >
      {/*
        * Cut to the two facts a business needs before it presses anything: what is owed, and
        * to how many. Recourse, proportionality and who Northwind is were three sentences a
        * person had to read past to find the button.
        */}
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Day 60</h2>
        <p data-testid="repay-owed" className="text-[14px] text-[var(--body)]">
          <b className="text-[var(--ink)]">{money(view.owedUsd)}</b> owed ·{' '}
          {holders.length === 1 ? '1 holder' : `${holders.length} holders`}
        </p>
      </header>

      <div className="flex flex-wrap gap-2.5 px-5 py-4">
        <Button onClick={() => end('repaid')} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? 'Paying each holder on Hedera…' : `Repay ${money(view.owedUsd)}`}
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
        <div className="eyebrow mb-2">{repaid ? 'Paid' : 'Holders'}</div>
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
          * The currency named, because a mock has to be, and whether the shares are live. One
          * line: the reasons Circle's faucet cannot fund this belong in a comment, not on a
          * screen a business is trying to pay from.
          */}
        <p data-testid="repay-money" className="mt-2 text-[13px] text-[var(--muted)]">
          Paid in mock USDC (mUSDC) on Hedera testnet, not Circle’s USDC ·{' '}
          {view.live ? 'shares read from the chain' : 'shares not live — Hedera could not be reached'}
        </p>
      </div>

      <div data-testid="outcome-record" className="border-t px-5 py-4">
        <div className="eyebrow mb-2">Your record after day 60</div>

        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="pb-1.5 font-medium" />
              <th className="pb-1.5 text-right font-medium">Before</th>
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
              <td className="py-1.5 text-[var(--ink)]">Next invoice costs</td>
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
            ? 'Not published yet.'
            : consequence?.published
              ? `Published to ENS. ${movement}.`
              : `Not published — ${consequence?.reason ?? 'the page could not be written to.'}`}
        </p>

        {/*
          * The record itself, one click away.
          *
          * "Published to Sepolia" is a claim about a place, and a claim about a place with no way
          * to go there is worth nothing — the whole argument for putting the history on ENS is
          * that the next funder reads it without asking us.
          */}
        {after && consequence?.published && (
          <a
            data-testid="outcome-record-link"
            href={`https://hackathon-deployment-portal-app.ens-cf.workers.dev/${ENS_NAME}/records`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[13px] font-medium text-[var(--accent)] hover:underline"
          >
            Open on ENS ↗
          </a>
        )}
      </div>

      {answer && (
        <div
          data-testid="repay-outcome"
          className={`border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed ${
            answer.outcome === 'defaulted' ? 'text-[var(--neg)]' : 'text-[var(--pos)]'
          }`}
        >
          <b>{headline(answer)}</b>{' '}
          {answer.reason && <span data-testid="repay-reason">{answer.reason}</span>}
        </div>
      )}
    </section>
  );
}
