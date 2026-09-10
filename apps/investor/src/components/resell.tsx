'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { HolderView, ResaleView } from '@/lib/hedera-ats/resale';

/** What the resale route answers with — the sale, or the refusal, and who holds what after it. */
interface Answer {
  buyer: string;
  units: number;
  hash?: string;
  refusal?: string;
  holders: HolderView[];
  cashReturnedUsd: number;
  live: boolean;
}

/**
 * The unidentified wallet already on the fund's transfer log.
 *
 * Nobody has ever approved it, which is the point: the receivable turns it away at the instant
 * of transfer, and the money it offered comes back with it.
 */
const NO_PASS_WALLET = '0xB0D30000000000000000000000000000000014FF';

/** Ours to say when the setup is unfinished; everything else is a rule somebody enforced. */
function notSetUp(reason: string): boolean {
  return /not open yet/.test(reason);
}

/**
 * How a refusal is introduced, which depends on who made it.
 *
 * A rule the portal applied before anything was signed and a rule the receivable applied during
 * the transfer are both refusals, and introducing them the same way would hide the difference
 * that matters — only one of them happened on the chain.
 */
function headline(reason: string): string {
  if (notSetUp(reason)) return 'The accounts this sale needs are not open yet.';
  if (/cannot offer/.test(reason)) return 'Will not offer.';
  return 'Refused by the receivable.';
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
 * The Sell half control, and the two-holder split it leaves behind.
 *
 * The split is read back off the receivable after every attempt, settled or refused, rather
 * than assembled from what the button was asked to do. That is what lets a refusal be legible:
 * the screen shows the fund still holding everything instead of asserting that nothing moved.
 *
 * The second button offers the same units to a wallet nobody approved. It is there deliberately
 * — a check nobody has watched refuse anything is indistinguishable from no check.
 */
export function Resell({ view }: { view: ResaleView }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);

  async function sell(buyer?: string) {
    setBusy(true);
    setAnswer(null);
    try {
      const response = await fetch('/api/resell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer }),
      });
      setAnswer((await response.json()) as Answer);
    } finally {
      setBusy(false);
    }
  }

  /*
   * Before the sale, the fund's own row is all there is to show; after it, the whole split is.
   * Both are the receivable's balances read back — the button never decides what appears here.
   */
  const held = view.holders[0];

  return (
    <section
      aria-label="Sell half of RCV-0001"
      className="overflow-hidden rounded-xl border bg-[var(--surface)]"
    >
      <header className="border-b px-5 py-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Sell half of RCV-0001</h2>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]">
          The fund gets its cash back on day 20 without waiting for the invoice to be paid. The
          buyer is checked by the receivable itself, at the moment the units move.
        </p>
      </header>

      {held && (
        <p className="border-b px-5 py-3 text-[14px] text-[var(--body)]">
          <b>Position held:</b> {held.units.toLocaleString('en-US')} units of RCV-0001 —{' '}
          {share(held.sharePct)} of the receivable.
        </p>
      )}

      <div className="flex flex-wrap gap-2.5 px-5 py-4">
        <Button onClick={() => sell()} disabled={busy}>
          Sell half
        </Button>
        <Button variant="outline" onClick={() => sell(NO_PASS_WALLET)} disabled={busy}>
          Sell half to a wallet with no pass
        </Button>
      </div>

      {answer && (
        <div className="border-t px-5 py-4">
          <div className="eyebrow mb-2">Who holds RCV-0001 now</div>
          <table data-testid="resale-split" className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="pb-1.5 font-medium">Holder</th>
                <th className="pb-1.5 font-medium">Wallet</th>
                <th className="pb-1.5 text-right font-medium">Units</th>
                <th className="pb-1.5 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {answer.holders.map((holder) => (
                <tr key={holder.wallet} className="border-t">
                  <td className="py-1.5 text-[var(--ink)]">{holder.name}</td>
                  <td className="py-1.5 tabular-nums text-[var(--muted)]">{short(holder.wallet)}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {holder.units.toLocaleString('en-US')}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-[var(--ink)]">
                    {share(holder.sharePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p data-testid="resale-cash-back" className="mt-3 text-[14px] text-[var(--body)]">
            <b>Cash returned to the fund:</b> {money(answer.cashReturnedUsd)}
          </p>

          {/*
            * Where these figures came from, said beside them. A split the portal could not
            * refresh is still worth showing, but a fund has to be able to tell it apart from
            * one that is current.
            */}
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {answer.live
              ? 'Read from the receivable on Hedera testnet.'
              : 'Not live — the balances on hand, shown because the Hedera endpoint could not be reached.'}
          </p>
        </div>
      )}

      {answer?.hash && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--pos)]">
          <b>Settled.</b> {answer.units.toLocaleString('en-US')} units sold — transaction{' '}
          {answer.hash}
        </div>
      )}

      {answer?.refusal && (
        <div
          data-testid="resale-refusal"
          className={`border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed ${
            notSetUp(answer.refusal) ? 'text-[var(--muted)]' : 'text-[var(--neg)]'
          }`}
        >
          <b>{headline(answer.refusal)}</b>{' '}
          No units moved and no money moved.{' '}
          {/*
            * The reason is repeated word for word rather than summarised. A sentence we wrote
            * here would read the same whether or not anything had actually refused.
            */}
          <span data-testid="resale-reason">{answer.refusal}</span>
        </div>
      )}
    </section>
  );
}
