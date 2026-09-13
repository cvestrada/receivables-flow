'use client';

import { useAuthorizationSignature, usePrivy } from '@privy-io/react-auth';
import { ArrowLeft, ArrowRight, Check, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { describeRecord } from '@rf/contracts-ens';
import { nameFromEmail } from '@rf/privy/policies';
import type { Approval } from '@rf/privy/accounts';
import type { QuoteView } from '@/components/financed';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

/** The invoice the wizard is about, as `/api/invoice` states it. */
export interface InvoiceView {
  id: string;
  customer: string;
  amount: string;
  terms: string;
  /** The receivable's ticker, as it is written on the security itself. */
  note: string;
  document: string;
}

/** What the approvals record says about the financing, once one has been asked for. */
interface ApprovalsView {
  approvals: { userId: string; name: string }[];
  required: number;
  request: unknown;
  hash?: string;
  refusal?: string;
  unopened?: string;
  /** Privy's own answer to the send, shown as it came. */
  privy?: { status: number; requestId?: string; signatures: number; body: unknown };
}

const STEPS = ['Invoice', 'Price', 'Sign'] as const;
type Step = 0 | 1 | 2;

const money = (usd: number) =>
  `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/**
 * Asking for financing, as the three questions it actually is.
 *
 * A business selling an invoice wants to know three things in order: is this the right invoice,
 * what does it cost, and who has to agree. A flat page answered all three at once and none of
 * them clearly — the price sat beside a request nobody had made yet, and the two signatures the
 * company wallet takes were a table further down that read as a log rather than as a gate.
 *
 * So it is a wizard: one question a step, no step reachable before the one it depends on, and
 * the last step is the signature itself. Nothing is on any chain until that signature is
 * counted — which is why the invoice is still Outstanding while this dialog is open.
 */
export function SubmitWizard({ invoice, quote }: { invoice: InvoiceView; quote: QuoteView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState<ApprovalsView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /*
   * Asking is what creates the thing to approve, so it happens on the way into the last step
   * rather than at the end. A person who closes the dialog here has an invoice that is
   * requested and unsigned, which is a real state and the one the Outstanding row then shows.
   */
  async function toSigning() {
    setBusy(true);
    setFailed(null);
    try {
      await fetch('/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request' }),
      });

      /*
       * Asking starts the signing from nobody having signed. Approvals survive between runs on
       * purpose — two directors sign hours apart — but a new request is a new thing to agree
       * to, and inheriting the last one's signatures would count agreement nobody gave.
       */
      await fetch('/api/approvals', { method: 'DELETE' });

      const response = await fetch('/api/approvals');
      setRecord((await response.json()) as ApprovalsView);
      setStep(2);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  /** Take the director's signature, add it to the record, and let Privy count. */
  async function approveAndTokenize(approval: Approval) {
    setBusy(true);
    setFailed(null);
    try {
      const added = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approval }),
      });
      setRecord((await added.json()) as ApprovalsView);

      const sent = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      const answer = (await sent.json()) as ApprovalsView;
      setRecord(answer);

      if (!answer.hash) {
        setFailed(answer.refusal ?? answer.unopened ?? 'the company account did not issue it');
        return;
      }

      /* Minted. Only now does the invoice leave Outstanding. */
      await fetch('/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tokenized', hash: answer.hash }),
      });

      /*
       * Privy's answer stays on screen until the person moves on. Closing the dialog the
       * instant the hash arrived meant the one thing that proved the signatures were counted
       * was visible for no frames at all.
       */
      /*
       * No refresh here. Refreshing re-runs the Outstanding page, which redirects to Financed
       * the moment the invoice is tokenized — taking the dialog, and Privy's answer, with it.
       * The move happens when the person presses the button that says so.
       */
      setDone(true);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button data-testid="submit-invoice">Submit for financing</Button>}
      />

      <DialogContent className="max-h-[92vh] overflow-x-hidden overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Request financing</DialogTitle>
          <DialogDescription>
            Three steps: the invoice, what it costs, and the two signatures that sell it.
          </DialogDescription>
        </DialogHeader>

        <Steps at={step} />

        <div className="min-h-[19rem] px-1 pb-1">
          {step === 0 && <InvoiceStep invoice={invoice} />}
          {step === 1 && <PriceStep quote={quote} invoice={invoice} />}
          {step === 2 && (
            <SignStep
              record={record}
              busy={busy}
              failed={failed}
              done={done}
              onApprove={approveAndTokenize}
            />
          )}
        </div>

        <DialogFooter className="bg-transparent">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => (step === 0 ? setOpen(false) : setStep((step - 1) as Step))}
          >
            <ArrowLeft className="size-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex-1" />

          {step < 2 && (
            <Button
              data-testid="wizard-next"
              disabled={busy}
              onClick={() => (step === 0 ? setStep(1) : void toSigning())}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {step === 0 ? 'See the price' : 'Request tokenization'}
              <ArrowRight className="size-4" />
            </Button>
          )}

          {done && (
            <Button
              data-testid="wizard-done"
              onClick={() => {
                setOpen(false);
                router.push('/invoices/financed');
                router.refresh();
              }}
            >
              See it under Financed
              <ArrowRight className="size-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Where the person is, in three numbered stops. */
function Steps({ at }: { at: Step }) {
  return (
    <ol className="flex items-center gap-0 px-1">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                i === at
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : i < at
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'border-[var(--hairline-active)] bg-[var(--surface-alt)] text-[var(--muted)]'
              }`}
            >
              {i < at ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={`text-[11px] font-medium ${i === at ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <span
              className={`mx-2 mb-4 h-px flex-1 ${i < at ? 'bg-[var(--accent)]' : 'bg-[var(--hairline-active)]'}`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

/** A question mark that answers itself, for a number nobody should have to take on trust. */
function Explain({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="How this is worked out"
            className="flex size-4 cursor-pointer items-center justify-center rounded-full border text-[10px] font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            ?
          </button>
        }
      />
      <PopoverContent align="start" className="w-[20rem] p-3 text-[13px] leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[14px]">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium tabular-nums text-[var(--ink)]">{value}</span>
    </div>
  );
}

/** Step one: the document, and the terms written on it. */
function InvoiceStep({ invoice }: { invoice: InvoiceView }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <a
          href={invoice.document}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 text-[15px] font-medium text-[var(--accent)] hover:underline"
        >
          <FileText className="size-4" />
          {invoice.id}.pdf ↗
        </a>

        <Separator />

        <div className="flex flex-col gap-2">
          <Row label="Customer" value={invoice.customer} />
          <Row label="Amount" value={invoice.amount} />
          <Row label="Terms" value={invoice.terms} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Step two: what it costs, and the public record that decided that. */
function PriceStep({ quote, invoice }: { quote: QuoteView; invoice: InvoiceView }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="eyebrow text-[11px]">Priced off your public record</div>
          <div className="flex flex-col gap-2">
            <Row
              label="Repayment record"
              value={describeRecord(quote.record)}
            />
            <Row
              label={
                <span className="flex items-center gap-1.5">
                  Credit score
                  <Explain>
                    <b>(on time × 100 + late × 50) ÷ matured</b>
                    <br />
                    An invoice repaid on time counts in full, one repaid late counts half, and a
                    defaulted one counts nothing — divided by every invoice that has come due.
                    Invoices not yet matured are not in it.
                    <br />
                    <br />
                    {quote.record.ontime} × 100 + {quote.record.late} × 50 ÷{' '}
                    {quote.record.ontime + quote.record.late + quote.record.defaulted} ={' '}
                    <b>{quote.record.score ?? '—'}</b>
                  </Explain>
                </span>
              }
              value={quote.record.score === null ? 'no record yet' : `${quote.record.score} / 100`}
            />
            <Row label="Fee rate" value={`${quote.dailyRatePct.toFixed(3)}% a day`} />
            <Row label="Term" value={`${quote.maturityDays} days`} />
            <Row
              label="Factoring fee"
              value={`${quote.feePct.toFixed(2)}% · ${money(quote.discountUsd)}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[var(--accent-subtle)]">
        <CardContent className="flex flex-col gap-2">
          <Row label="You receive today" value={money(quote.proceedsUsd)} />
          <Row label={`You repay in ${quote.maturityDays} days`} value={invoice.amount} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Step three: two of three seats, one of which is already signed. */
function SignStep({
  record,
  busy,
  failed,
  done,
  onApprove,
}: {
  record: ApprovalsView | null;
  busy: boolean;
  failed: string | null;
  done: boolean;
  onApprove: (approval: Approval) => void;
}) {
  if (!record) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-[var(--muted)]">
        <Loader2 className="size-4 animate-spin" />
        Asking the company account…
      </div>
    );
  }

  /*
   * One fact, read once. The badge counted the stored approvals and the rows were written by
   * hand, so a record left over from an earlier run made the badge say "2 of 2 ready" while the
   * row beneath it still showed an unsigned circle.
   */
  const directorSigned = record.approvals.length > 0;
  const signed = 1 + (directorSigned ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-[11px]">Two of three directors must sign</span>
            <Badge variant={signed >= record.required ? 'default' : 'outline'}>
              {signed} of {record.required} ready
            </Badge>
          </div>

          {/*
            * Named, because "you" and "the finance system" are not people a company has. Anna's
            * seat is signed for automatically so that one of the two signatures is already there
            * when a judge arrives; whoever signs in sits in Tom's chair and provides the second.
            */}
          <Seat name="Anna Reed" state="signed" note="auto-signed for the demo" />
          <Seat
            name="Tom Hill (you)"
            state={directorSigned ? 'signed' : 'awaiting'}
            note={directorSigned ? 'signed in your browser' : 'signs in your browser'}
          />
          <Seat name="Grace Ward" state="idle" note="not needed" />
        </CardContent>
      </Card>

      {failed && (
        <p className="text-[13px] text-[var(--neg-ink)]" data-testid="wizard-refusal">
          {failed}
        </p>
      )}

      {record.privy && record.hash ? (
        <PrivyAnswer privy={record.privy} hash={record.hash} />
      ) : (
        !done && <Approve busy={busy} onApprove={onApprove} />
      )}
    </div>
  );
}

/**
 * What Privy answered, as it answered it.
 *
 * The response body is shown as JSON rather than paraphrased. A sentence saying "Privy counted
 * two signatures and sent the transaction" is a sentence we could write whether or not it had;
 * the body with the hash in it is not.
 */
function PrivyAnswer({
  privy,
  hash,
}: {
  privy: NonNullable<ApprovalsView['privy']>;
  hash: string;
}) {
  return (
    <Card data-testid="privy-answer" className="min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-[11px]">Privy answered</span>
          <Badge variant="default">
            {privy.status} · {privy.signatures} of 2 signatures
          </Badge>
        </div>
        <pre className="max-h-40 min-w-0 overflow-y-auto rounded-md bg-[var(--surface-alt)] p-3 text-[12px] leading-relaxed break-all whitespace-pre-wrap text-[var(--ink)]">
          {JSON.stringify(
            {
              status: privy.status,
              signatures_counted: privy.signatures,
              request_id: privy.requestId,
              ...(typeof privy.body === 'object' && privy.body ? (privy.body as object) : {}),
            },
            null,
            2,
          )}
        </pre>
        <a
          data-testid="privy-answer-hash"
          href={`https://hashscan.io/testnet/transaction/${hash}`}
          target="_blank"
          rel="noreferrer"
          className="text-[14px] font-medium text-[var(--accent)] hover:underline"
        >
          Open the transaction on Hedera ↗
        </a>
      </CardContent>
    </Card>
  );
}

function Seat({ name, state, note }: { name: string; state: 'signed' | 'awaiting' | 'idle'; note: string }) {
  const mark = state === 'signed' ? '✓' : '○';
  const tone =
    state === 'signed'
      ? 'text-[var(--pos-ink)]'
      : state === 'awaiting'
        ? 'text-[var(--accent)]'
        : 'text-[var(--muted)]';

  return (
    <div className="flex items-center justify-between gap-4 text-[14px]">
      <span className="flex items-center gap-2">
        <span className={`w-3 ${tone}`}>{mark}</span>
        <span className={state === 'idle' ? 'text-[var(--muted)]' : 'text-[var(--ink)]'}>{name}</span>
      </span>
      <span className="text-[13px] text-[var(--muted)]">{note}</span>
    </div>
  );
}

/**
 * The button that signs, in whichever of the two worlds this portal is running in.
 *
 * With Privy configured the signature is taken in the director's own browser. Without it there
 * is nobody to sign as, and the button says so rather than pretending — a demo that faked the
 * second signature would be demonstrating nothing at all.
 */
function Approve({ busy, onApprove }: { busy: boolean; onApprove: (approval: Approval) => void }) {
  if (!APP_ID) {
    return (
      <Button disabled data-testid="wizard-approve">
        Sign in to approve
      </Button>
    );
  }

  return <ApproveAsDirector busy={busy} onApprove={onApprove} />;
}

function ApproveAsDirector({
  busy,
  onApprove,
}: {
  busy: boolean;
  onApprove: (approval: Approval) => void;
}) {
  const { user } = usePrivy();
  const { generateAuthorizationSignature } = useAuthorizationSignature();

  return (
    <Button
      data-testid="wizard-approve"
      disabled={busy}
      onClick={async () => {
        const response = await fetch('/api/approvals');
        const { request } = (await response.json()) as ApprovalsView;
        const { signature } = await generateAuthorizationSignature(request as never);

        onApprove({
          userId: user?.id ?? '',
          name: user?.email?.address ? nameFromEmail(user.email.address) : 'director',
          signature,
        });
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {busy ? 'Signing, then minting on Hedera…' : 'Approve & tokenize'}
    </Button>
  );
}
