'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Answer {
  usd: number;
  hash?: string;
  refusal?: string;
}

/** Privy's refusals name a rule; everything else is the setup not being finished. */
function isRefusal(reason: string): boolean {
  return /Privy refused/.test(reason);
}

const WITHIN_MANDATE_USD = 47_500;
const OVER_MANDATE_USD = 150_000;

/** An invoice nobody has rated, so it is on no list the fund may buy from. */
const UNRATED_INVOICE = `0x${'9'.repeat(40)}`;

function dollars(usd: number): string {
  return `$${usd.toLocaleString('en-US')}`;
}

/**
 * The allocation control, offering one allocation the mandate permits and two it
 * does not.
 *
 * The two that breach it are on screen deliberately. A mandate nobody has watched
 * refuse anything is indistinguishable from no mandate, and the refusal shown is
 * the fund account's own — this component never checks an amount against a cap.
 */
export function Allocate() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);

  /** The fund account's answer, shown over the page so nobody can miss it. */
  const shown = useRef<HTMLDialogElement>(null);

  async function ask(usd: number, invoice?: string) {
    setBusy(true);
    setAnswer(null);
    try {
      const response = await fetch('/api/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usd, invoice }),
      });
      const fresh = (await response.json()) as Answer;
      setAnswer(fresh);

      /*
       * The answer is put in the way rather than left at the bottom of the panel.
       *
       * A mandate refusing is the whole reason these two buttons exist, and a strip
       * appearing below the fold is something a room watching a demo does not see —
       * they watch a click produce nothing, which reads as a dead button rather than
       * as a control doing its job.
       */
      if (fresh.refusal || fresh.hash) shown.current?.showModal();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Allocate into RCV-0001" className="overflow-hidden rounded-xl border bg-[var(--surface)]">
      <header className="border-b px-5 py-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Allocate into RCV-0001</h2>
        <p className="mt-0.5 text-[14px] text-[var(--muted)]">
          The fund&rsquo;s account signs what its mandate allows and nothing else.
        </p>
      </header>

      <div className="flex flex-wrap gap-2.5 px-5 py-4">
        <Button onClick={() => ask(WITHIN_MANDATE_USD)} disabled={busy}>
          Allocate {dollars(WITHIN_MANDATE_USD)}
        </Button>
        <Button variant="outline" onClick={() => ask(OVER_MANDATE_USD)} disabled={busy}>
          Allocate {dollars(OVER_MANDATE_USD)} — over the cap
        </Button>
        <Button
          variant="outline"
          onClick={() => ask(WITHIN_MANDATE_USD, UNRATED_INVOICE)}
          disabled={busy}
        >
          Allocate into an unrated invoice
        </Button>
      </div>

      {answer?.refusal && isRefusal(answer.refusal) && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--neg)]">
          <b>Will not sign.</b> {answer.refusal}
        </div>
      )}
      {answer?.refusal && !isRefusal(answer.refusal) && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--muted)]">
          <b>The fund&rsquo;s account is not open yet.</b> {answer.refusal} — run{' '}
          <code>npm run provision -w @rf/privy</code> once the Privy credentials are in{' '}
          <code>libs/privy/.env</code>.
        </div>
      )}
      {answer?.hash && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--pos)]">
          <b>Signed and sent.</b> {dollars(answer.usd)} — transaction {answer.hash}
        </div>
      )}
      <dialog
        ref={shown}
        aria-label="What the fund's account answered"
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border bg-[var(--surface)] p-0 text-[var(--body)] shadow-2xl backdrop:bg-black/50"
      >
        <div className="border-b px-6 py-5">
          <h2 className="text-[18px] font-semibold text-[var(--ink)]">
            {answer?.hash ? 'Signed and sent' : 'Will not sign'}
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed">
            {answer?.hash
              ? `${dollars(answer.usd)} allocated into RCV-0001.`
              : 'The fund\u2019s account declined to sign. No money moved.'}
          </p>
        </div>

        <div className="px-6 py-5 text-[14px] leading-relaxed">
          {/*
            * The reason is repeated word for word rather than summarised. A sentence
            * we wrote here would be a sentence we could write whether or not anything
            * had refused.
            */}
          {answer?.hash ? (
            <span>transaction {answer.hash}</span>
          ) : (
            <span className={answer?.refusal && isRefusal(answer.refusal) ? 'text-[var(--neg)]' : 'text-[var(--muted)]'}>
              {answer?.refusal}
            </span>
          )}
        </div>

        <div className="flex justify-end border-t px-6 py-4">
          <Button variant="outline" onClick={() => shown.current?.close()}>
            Close
          </Button>
        </div>
      </dialog>
    </section>
  );
}
