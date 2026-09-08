'use client';

import { useEffect, useState } from 'react';
import { useAuthorizationSignature, usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';

interface View {
  invoice: string;
  amount: string;
  sale: unknown;
  approvals: { userId: string; name: string }[];
  required: number;
  ready: boolean;
  hash?: string;
  refusal?: string;
}

/** The name before the @, which is how the approval record refers to a director. */
function who(email: string | undefined): string {
  return email?.split('@')[0] ?? 'director';
}

/**
 * The Approvals section, counting approvals that actually happened.
 *
 * A director approves by signing the sale with their own key, in their own
 * browser. Nothing here decides whether the sale may proceed — it collects
 * signatures and shows how many have arrived. Whether two is enough is a question
 * only the company account can answer, and it answers it when Send is pressed.
 */
export function Approvals() {
  const { user, authenticated } = usePrivy();
  const { generateAuthorizationSignature } = useAuthorizationSignature();
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

  const email = user?.email?.address;
  const mine = view.approvals.some((approval) => approval.userId === user?.id);

  async function approve() {
    if (!view || !user) return;
    setBusy(true);
    try {
      const { signature } = await generateAuthorizationSignature(view.sale as never);
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approval: { userId: user.id, name: who(email), signature },
        }),
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
    <section className="overflow-hidden rounded-xl border bg-[var(--surface)]">
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
        <Button onClick={approve} disabled={!authenticated || mine || busy}>
          {mine ? `Approved as ${who(email)}` : `Approve as ${who(email)}`}
        </Button>
        {/*
          * Offered at any count on purpose. Pressing it with one approval is how the
          * refusal is produced on demand, and the account is the thing that refuses.
          */}
        <Button variant="outline" onClick={send} disabled={busy}>
          Send to the company account
        </Button>
      </div>

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
