'use client';

import { useState, useTransition } from 'react';

import { approve, reject, type Decision } from '@/lib/ens/actions';
import type { Party } from '@/lib/ens/standing';

const EXPLORER = 'https://hackathon-deployment-portal-app.ens-cf.workers.dev';
const ETHERSCAN = 'https://sepolia.etherscan.io/tx';

/**
 * One row per party, and the two decisions staff can make about it.
 *
 * The row shows what the registry says right now, not what was clicked — a decision that fails
 * on chain has to leave the row reading the way the chain does, or the page becomes the thing
 * staff trust instead of the record.
 */
export function Standing({ parties }: { parties: Party[] }) {
  return (
    <div className="desk overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h3 className="text-[16px] font-semibold text-[var(--ink)]">Parties</h3>
        <span className="st st-idle">{parties.filter((p) => p.approved).length} of {parties.length} approved</span>
      </div>
      <div className="flex flex-col">
        {parties.map((party) => (
          <Row key={party.id} party={party} />
        ))}
      </div>
      <div className="panel-note border-t bg-[var(--surface-alt)] px-5 py-3.5 text-[14px] leading-relaxed text-[var(--muted)]">
        Every decision here is published to ENS on Sepolia and readable by anyone, with or
        without this page.
      </div>
    </div>
  );
}

function Row({ party }: { party: Party }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Decision | undefined>();

  const run = (decision: () => Promise<Decision>) =>
    start(async () => {
      setResult(undefined);
      setResult(await decision());
    });

  return (
    <div
      data-testid={`row-${party.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4 last:border-b-0"
    >
      <div className="min-w-0 flex-1 basis-[260px]">
        <div className="text-[15px] font-medium text-[var(--ink)]">{party.label}</div>
        <a
          className="break-all text-[13px] text-[var(--muted)] hover:text-[var(--accent)]"
          href={`${EXPLORER}/${party.name}`}
          target="_blank"
          rel="noreferrer"
        >
          {party.name || 'no name issued'}
        </a>
        {result?.hash ? (
          <div className="mt-1 text-[13px]">
            <a className="text-[var(--accent)]" href={`${ETHERSCAN}/${result.hash}`} target="_blank" rel="noreferrer">
              {result.hash.slice(0, 10)}…{result.hash.slice(-6)}
            </a>
          </div>
        ) : null}
        {result?.problem ? <div className="mt-1 text-[13px] text-[var(--neg-ink)]">{result.problem}</div> : null}
      </div>

      <span className={party.approved ? 'st st-ok' : 'st st-idle'} data-testid={`status-${party.id}`}>
        {party.approved ? `Approved · to ${party.until}` : 'Not approved'}
      </span>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approve(party, party.subject))}
          className="rounded-[8px] bg-[var(--accent)] px-[14px] py-[8px] text-[14px] font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Working…' : 'Approve KYC'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reject(party))}
          className="rounded-[8px] border border-[var(--neg-subtle)] bg-[var(--surface)] px-[14px] py-[8px] text-[14px] font-medium text-[var(--neg-ink)] disabled:opacity-50"
        >
          Reject KYC
        </button>
      </div>
    </div>
  );
}
