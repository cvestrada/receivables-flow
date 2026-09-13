'use client';

import { Loader2 } from 'lucide-react';
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
 * The buyer nobody has ever approved, named rather than addressed.
 *
 * Which wallet that is depends on the key the server holds for it, so the name is what travels
 * and the route resolves it. That is the point of the button: the receivable turns that wallet
 * away at the instant of transfer, and the money it offered comes back with it — a refusal from
 * the asset, not from us.
 */

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
      aria-label="Sell half to another KYC-approved investor"
      className="overflow-hidden rounded-xl border bg-[var(--surface)]"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Sell half to another KYC-approved investor</h2>
        {held && (
          <p className="text-[14px] text-[var(--body)]">
            holding <b className="text-[var(--ink)]">{held.units.toLocaleString('en-US')}</b>{' '}
            units · {share(held.sharePct)}
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-2.5 px-5 py-4">
        {/*
          * One button. The "sell to a wallet with no pass" control proved the asset's refusal,
          * and the refusal is still asserted — from the Mandate tab, where a rule being refused
          * belongs — but on the tab where money moves it read as a second thing to do.
          */}
        {/*
          * Once. The button stayed live after the sale and a second press sold the other half,
          * leaving the fund with nothing and the screen with a button that could only refuse.
          * A position that is already shared has been sold; what remains is held to maturity.
          */}
        {(held?.sharePct ?? 0) >= 100 && !answer?.hash ? (
          <Button onClick={() => sell()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? 'Settling on Hedera…' : 'Sell half to Bridgeline Partners (KYC-approved)'}
          </Button>
        ) : (
          <span className="text-[14px] text-[var(--muted)]">Sold — half is held to maturity.</span>
        )}
      </div>

      {answer && (
        <div className="border-t px-5 py-4">
          <div className="eyebrow mb-2">Holders</div>
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
            Cash back <b className="text-[var(--ink)]">{money(answer.cashReturnedUsd)}</b>
            <span className="ml-2 text-[13px] text-[var(--muted)]">
              · {answer.live ? 'read from the chain' : 'not live'}
            </span>
          </p>
        </div>
      )}

      {answer?.hash && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--pos)]">
          <b>Settled.</b>{' '}
          {/*
            * A link, not a printed hash. Sixty-six characters of hex are something a viewer has
            * to copy somewhere else to believe; the whole claim of settling on a public chain is
            * that they can look without asking us, so the screen takes them there.
            */}
          <a
            data-testid="resale-transaction"
            href={`https://hashscan.io/testnet/transaction/${answer.hash}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            view on HashScan ↗
          </a>
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
