'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Answer {
  usd: number;
  hash?: string;
  refusal?: string;
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

  async function ask(usd: number, invoice?: string) {
    setBusy(true);
    setAnswer(null);
    try {
      const response = await fetch('/api/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usd, invoice }),
      });
      setAnswer(await response.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-[var(--surface)]">
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

      {answer?.refusal && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--neg)]">
          <b>Will not sign.</b> {answer.refusal}
        </div>
      )}
      {answer?.hash && (
        <div className="border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--pos)]">
          <b>Signed and sent.</b> {dollars(answer.usd)} — transaction {answer.hash}
        </div>
      )}
    </section>
  );
}
