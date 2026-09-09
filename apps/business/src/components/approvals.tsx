'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Approval } from '@rf/privy/accounts';

interface View {
  invoice: string;
  customer: string;
  amount: string;
  /** The note's ticker, as it is written on the security itself. */
  note: string;
  request: unknown;
  approvals: { userId: string; name: string }[];
  required: number;
  ready: boolean;
  hash?: string;
  refusal?: string;
  /** Set when no account has been opened yet, carrying what is missing. */
  unopened?: string;
}

/*
 * Where the chain shows what happened, for anyone who does not take our word for it.
 */
const HASHSCAN_TRANSACTION = 'https://hashscan.io/testnet/transaction';

/**
 * The Approvals section, counting approvals that actually happened.
 *
 * A director approves by signing the issuance with their own key, in their own
 * browser. Nothing here decides whether the issuance may proceed — it collects
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
  /** Produces the signed-in director's approval of the issuance, when one is signed in. */
  approve?: (request: unknown) => Promise<Approval>;
  signedInAs?: string;
}) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);

  /** The company account's answer, shown over the page so nobody can miss it. */
  const answer = useRef<HTMLDialogElement>(null);

  /*
   * A director arriving mid-approval must see where the issuance already stands, so the
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
        body: JSON.stringify({ action: 'approve', approval: await approve(view.request) }),
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
      const fresh = (await response.json()) as View;
      setView(fresh);

      /*
       * The answer is put in the way rather than left at the bottom of the panel.
       *
       * A refusal is the whole point of pressing this button, and a strip appearing
       * below the fold is something a room full of people watching a demo will miss
       * entirely — they see a click and then nothing, which reads as a broken button
       * rather than as a control doing its job.
       */
      if (fresh.refusal || fresh.unopened || fresh.hash) answer.current?.showModal();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Issue this receivable"
      className="overflow-hidden rounded-xl border bg-[var(--surface)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Issue this receivable</h2>
          <p className="mt-0.5 text-[14px] text-[var(--muted)]">
            {view.invoice} · {view.amount} owed by {view.customer} · issues {view.amount.replace('$', '')}{' '}
            {view.note} notes
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
      {/*
        * The transaction is linked rather than described, because the terms it
        * carries are readable on the chain by anyone and readable nowhere else
        * without believing this screen.
        */}
      {view.hash && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--pos)]">
          <b>Issued.</b> {view.amount.replace('$', '')} {view.note} notes now exist —{' '}
          <a
            className="underline"
            href={`${HASHSCAN_TRANSACTION}/${view.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {view.hash}
          </a>
        </div>
      )}
      <dialog
        ref={answer}
        aria-label="What the company account answered"
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border bg-[var(--surface)] p-0 text-[var(--body)] shadow-2xl backdrop:bg-black/50"
      >
        <div className="border-b px-6 py-5">
          <h2 className="text-[18px] font-semibold text-[var(--ink)]">
            {view.hash ? 'Issued' : 'Not issued'}
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed">
            {view.hash
              ? `${view.amount.replace('$', '')} ${view.note} notes now exist.`
              : 'The company account did not act. Nothing was issued.'}
          </p>
        </div>

        <div className="px-6 py-5 text-[14px] leading-relaxed">
          {/*
            * The reason is repeated word for word rather than summarised. A sentence
            * we wrote here would be a sentence we could write whether or not anything
            * had refused.
            */}
          {view.hash ? (
            <a className="underline" href={`${HASHSCAN_TRANSACTION}/${view.hash}`} target="_blank" rel="noreferrer">
              {view.hash}
            </a>
          ) : (
            <span className="text-[var(--neg)]">{view.refusal ?? view.unopened}</span>
          )}
        </div>

        <div className="flex justify-end border-t px-6 py-4">
          <Button variant="outline" onClick={() => answer.current?.close()}>
            Close
          </Button>
        </div>
      </dialog>
    </section>
  );
}
