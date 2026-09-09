'use client';

import { useRef, useState, useTransition } from 'react';

import { approve, reject, type Decision } from '@/lib/ens/actions';
import type { Party } from '@/lib/ens/standing';

const EXPLORER = 'https://hackathon-deployment-portal-app.ens-cf.workers.dev';
const ETHERSCAN = 'https://sepolia.etherscan.io/tx';

/**
 * One row per party, and the one decision that is available on it.
 *
 * A party is either approved or not, so only one of the two decisions can ever apply — showing
 * both would offer staff a button that does nothing and invite a click that spends gas to
 * rewrite a record with the value it already holds.
 */
export function Standing({ parties }: { parties: Party[] }) {
  return (
    <div className="desk overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h3 className="text-[16px] font-semibold text-[var(--ink)]">Parties</h3>
        <span className="st st-idle">
          {parties.filter((p) => p.approved).length} of {parties.length} approved
        </span>
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
  const confirming = useRef<HTMLDialogElement>(null);

  /*
   * Both decisions are irreversible in the sense that matters: each one spends gas and changes
   * a record strangers read. Asking first is what stops a mis-aimed click from doing that, and
   * the question names the party so it is obvious which row is about to change.
   */
  const act = () =>
    start(async () => {
      confirming.current?.close();
      setResult(undefined);
      setResult(party.approved ? await reject(party) : await approve(party, party.subject));
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

      <button
        type="button"
        disabled={pending}
        onClick={() => confirming.current?.showModal()}
        className={
          party.approved
            ? 'rounded-[8px] border border-[var(--neg-subtle)] bg-[var(--surface)] px-[14px] py-[8px] text-[14px] font-medium text-[var(--neg-ink)] disabled:opacity-50'
            : 'rounded-[8px] bg-[var(--accent)] px-[14px] py-[8px] text-[14px] font-medium text-white disabled:opacity-50'
        }
      >
        {pending ? 'Working…' : party.approved ? 'Revoke KYC' : 'Approve KYC'}
      </button>

      <Confirm party={party} ref={confirming} onConfirm={act} />
    </div>
  );
}

function Confirm({
  party,
  ref,
  onConfirm,
}: {
  party: Party;
  ref: React.RefObject<HTMLDialogElement | null>;
  onConfirm: () => void;
}) {
  const revoking = party.approved;

  return (
    <dialog
      ref={ref}
      data-testid={`confirm-${party.id}`}
      className="m-auto w-[min(440px,92vw)] rounded-[12px] border bg-[var(--surface)] p-0 text-[var(--body)] backdrop:bg-[rgba(10,37,64,.35)]"
    >
      <div className="flex flex-col gap-3 px-6 py-5">
        <h4 className="text-[17px] font-semibold text-[var(--ink)]">
          {revoking ? 'Revoke KYC' : 'Approve KYC'} for {party.label}?
        </h4>
        <p className="text-[14.5px] leading-relaxed">
          {revoking
            ? `This takes ${party.label} off the register straight away. It will not be able to hold a receivable until it is approved again.`
            : `This puts ${party.label} on the register for 90 days, naming ${party.subject.slice(0, 10)}…${party.subject.slice(-6)}.`}
        </p>
        <p className="text-[13px] text-[var(--muted)]">
          Published to ENS on Sepolia. It spends gas and anyone can read the result.
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t bg-[var(--surface-alt)] px-6 py-3.5">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="rounded-[8px] border border-[var(--hairline-active)] bg-[var(--surface)] px-[14px] py-[8px] text-[14px] font-medium text-[var(--body)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          data-testid={`confirm-go-${party.id}`}
          className={
            revoking
              ? 'rounded-[8px] bg-[var(--neg)] px-[14px] py-[8px] text-[14px] font-medium text-white'
              : 'rounded-[8px] bg-[var(--accent)] px-[14px] py-[8px] text-[14px] font-medium text-white'
          }
        >
          {revoking ? 'Revoke KYC' : 'Approve KYC'}
        </button>
      </div>
    </dialog>
  );
}
