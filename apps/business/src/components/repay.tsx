'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Payment, RepaymentView } from '@/lib/hedera-ats/repay';

/** How day 60 ended, as the route reports it back. */
interface Answer {
  outcome: 'repaid' | 'defaulted';
  owedUsd: number;
  holders: Payment[];
  live: boolean;
  settled: boolean;
  reason?: string;
  already: boolean;
}

function money(usd: number): string {
  return `$${Math.round(usd).toLocaleString('en-US')}`;
}

function share(pct: number): string {
  return `${pct.toFixed(2)}%`;
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
  return answer.settled ? 'Repaid in full.' : 'Repayment divided, but nothing was transferred.';
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
export function Repay({ view }: { view: RepaymentView }) {
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
                ) : (
                  <td
                    data-testid={answer ? 'repay-holder-paid' : 'repay-holder-owed'}
                    className={`py-1.5 text-right tabular-nums ${answer ? 'text-[var(--pos)]' : 'text-[var(--muted)]'}`}
                  >
                    {money(holder.owedUsd)}
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
        <p className="mt-2 text-[13px] text-[var(--muted)]">
          {view.live
            ? 'Shares read from the receivable on Hedera testnet — the units held are the chain’s figures, not ours.'
            : 'Not live — the balances on hand, shown because the Hedera endpoint could not be reached. Nothing here was typed into the page.'}
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
          {answer.holders[0]?.hash && (
            <span className="text-[var(--muted)]"> First transfer: {answer.holders[0].hash}</span>
          )}
        </div>
      )}
    </section>
  );
}
