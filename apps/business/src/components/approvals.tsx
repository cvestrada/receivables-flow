'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Approval } from '@rf/privy/accounts';

interface View {
  invoice: string;
  amount: string;
  sale: unknown;
  approvals: { userId: string; name: string }[];
  required: number;
  ready: boolean;
  hash?: string;
  refusal?: string;
  /** Set when no account has been opened yet, carrying what is missing. */
  unopened?: string;
}

/**
 * The Approvals section, counting approvals that actually happened.
 *
 * A director approves by signing the sale with their own key, in their own
 * browser. Nothing here decides whether the sale may proceed — it collects
 * signatures and shows how many have arrived. Whether two is enough is a question
 * only the company account can answer, and it answers it when Send is pressed.
 *
 * Signing arrives as a prop rather than a hook, because this panel also renders
 * with no Privy app configured — the state the walkthrough runs in, and the state
 * a browser test can reach. Reading the record and sending it are the same in both;
 * only producing a signature needs a signed-in director.
 */
export function Approvals({
  approve,
  signedInAs,
}: {
  /** Produces the signed-in director's approval of the sale, when one is signed in. */
  approve?: (sale: unknown) => Promise<Approval>;
  signedInAs?: string;
}) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * A director arriving mid-approval must see where the sale already stands, so the
   * record is read once on arrival rather than assumed empty. Every later change to
   * it comes back from the action that caused it.
   */
  useEffect(() => {
    let showing = true;
    fetch('/api/approvals')
      .then((response) => (response.ok ? response.json() : null))
      .then((fresh) => {
        if (showing) setView(fresh);
      });
    return () => {
      showing = false;
    };
  }, []);

  if (!view) return null;

  const opened = !view.unopened;

  const mine = Boolean(signedInAs) && view.approvals.some((a) => a.name === signedInAs);

  async function record() {
    if (!view || !approve) return;
    setBusy(true);
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approval: await approve(view.sale) }),
      });
      setView(await response.json());
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      setView(await response.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Sell this invoice" className="overflow-hidden rounded-xl border bg-[var(--surface)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Sell this invoice</h2>
          <p className="mt-0.5 text-[14px] text-[var(--muted)]">
            {view.invoice} · {view.amount} to Woodgrove Capital
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-tint)] px-3 py-1 text-[14px] tabular-nums text-[var(--body)]">
          {view.approvals.length} of {view.required} approved
        </span>
      </header>

      <ul className="divide-y">
        {view.approvals.map((approval) => (
          <li key={approval.userId} className="flex items-center justify-between px-5 py-3">
            <span className="text-[15px] text-[var(--ink)]">{approval.name}</span>
            <span className="st st-ok">Approved</span>
          </li>
        ))}
        {view.approvals.length === 0 && (
          <li className="px-5 py-3 text-[15px] text-[var(--muted)]">Nobody has approved yet.</li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2.5 border-t px-5 py-4">
        <Button onClick={record} disabled={!approve || !opened || mine || busy}>
          {!approve
            ? 'Sign in to approve'
            : mine
              ? `Approved as ${signedInAs}`
              : `Approve as ${signedInAs}`}
        </Button>
        {/*
          * Offered at any count on purpose. Pressing it with one approval is how the
          * refusal is produced on demand, and the account is the thing that refuses.
          */}
        {/*
          * Never disabled, including before the accounts are open. Pressing it is how
          * you find out what the company account says, and refusing to ask on its
          * behalf would put the decision back in our code — which is the thing this
          * whole section exists to take out of it.
          */}
        <Button variant="outline" onClick={send} disabled={busy}>
          Send to the company account
        </Button>
      </div>

      {view.unopened && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--muted)]">
          <b>The company account is not open yet.</b> Approving needs it to exist —
          run <code>npm run provision -w @rf/privy</code> once the Privy credentials are in{' '}
          <code>libs/privy/.env</code>.
        </div>
      )}

      {view.refusal && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--neg)]">
          <b>Refused by Privy.</b> {view.refusal}
        </div>
      )}
      {view.hash && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--pos)]">
          <b>Sold.</b> Transaction {view.hash}
        </div>
      )}
    </section>
  );
}
