import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INVOICE } from '@rf/shared/invoice';

/**
 * Where Ironline's invoice has got to, read straight off disk.
 *
 * Shared by the route that changes it and the pages that render it, so a page never learns the
 * state by calling its own API over the network — which would be a second round trip to answer
 * a question the process can already answer, and a second place for the answer to drift.
 */
const STORE = join(process.env.DEMO_STATE_DIR ?? '.', '.submitted.json');

export type InvoiceStatus = 'outstanding' | 'requested' | 'tokenized';

export interface Submission {
  submitted: boolean;
  at?: string;
  /** The transaction that minted the receivable, once Privy counted two signatures. */
  hash?: string;
  tokenizedAt?: string;
}

export function readSubmission(): Submission {
  if (!existsSync(STORE)) return { submitted: false };

  try {
    return JSON.parse(readFileSync(STORE, 'utf8')) as Submission;
  } catch {
    return { submitted: false };
  }
}

export function writeSubmission(held: Submission): Submission {
  writeFileSync(STORE, `${JSON.stringify(held, null, 2)}\n`);
  return held;
}

export function forgetSubmission(): void {
  try {
    unlinkSync(STORE);
  } catch {
    /* Already forgotten, which is the state this asks for. */
  }
}

export function statusOf(held: Submission): InvoiceStatus {
  if (held.hash) return 'tokenized';
  return held.submitted ? 'requested' : 'outstanding';
}

/** The invoice itself, as every screen states it. Taken from the shared record, never retyped. */
export function invoiceView() {
  return {
    id: INVOICE.reference,
    customer: INVOICE.customer,
    amount: `$${INVOICE.faceValueUsd.toLocaleString('en-US')}`,
    terms: `${INVOICE.maturityDays} days`,
    note: INVOICE.noteTicker,
    document: `/${INVOICE.reference}.pdf`,
  };
}
