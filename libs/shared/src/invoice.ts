/**
 * The one invoice the demo runs on, and the note it becomes.
 *
 * Face value and maturity decide how many notes are issued and when they are
 * payable, and they are read by three things that never see each other: the
 * portal that offers the issuance, the transaction the directors sign, and the
 * script that creates the note on the chain. Writing the number beside any one of
 * them would let an approval promise $50,000 while the note it created capped out
 * somewhere else — with nothing on screen to show the two had drifted apart.
 */

/** An invoice, and the terms of the note issued against it. */
export interface DemoInvoice {
  /** How the invoice is referred to on paper and in the portal. */
  reference: string;
  /** The business that owes the money and has never touched the platform. */
  customer: string;
  /** What the customer owes, in whole US dollars. One note is issued per dollar. */
  faceValueUsd: number;
  /** Days from the note being created until the invoice is payable. */
  maturityDays: number;
  /** The note's full name, as it is written onto the security itself. */
  noteName: string;
  /** The note's ticker, as it is written onto the security itself. */
  noteTicker: string;
}

/** Ironline Freight's invoice to Northwind Brokerage — the receivable the demo issues and sells. */
export const INVOICE: DemoInvoice = {
  reference: 'INV-2026-0417',
  customer: 'Northwind Brokerage',
  faceValueUsd: 50_000,
  maturityDays: 60,
  noteName: 'Receivables Flow · Ironline Freight Note 2026-0417',
  noteTicker: 'INV0417',
};
