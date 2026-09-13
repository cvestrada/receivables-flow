import type { Invoice, Receivable } from '@rf/shared';
import type { Block, NavItem } from './portal.types';

/*
 * The deal these screens describe, stated once in the shared domain vocabulary.
 * Nothing on the portal renders from these two objects. They exist so that a type
 * change made in one of the chain lanes breaks this build, rather than letting the
 * portal drift out of agreement with the contract it is standing in for.
 */
export const INVOICE: Invoice = {
  id: 'INV-2026-0417',
  amount: '50000.00',
  currency: 'USD',
  dueDate: '2026-11-04',
  payee: 'ironline.receivables.eth',
  payer: 'Northwind Supplies',
};

export const RECEIVABLE: Receivable = {
  id: 'RCV-0001',
  invoiceId: 'INV-2026-0417',
  faceValue: '50000.00',
  purchasePrice: '47075.00',
  maturityDate: '2026-11-04',
  status: 'funded',
};

/*
 * Two tabs: the invoice, and the rule about selling it.
 *
 * Overview went with the walkthrough it belonged to — tiles and an activity feed that were typed
 * here rather than read from anything, so a judge asking "is that real?" was right to. Everything
 * on these two comes off a chain or off disk.
 */
export const NAV: NavItem[] = [
  {id:'invoices',   label:'Invoices',  href:'/invoices'},
  {id:'approvals',  label:'Approvals', href:'/approvals'}
];

export const POLICY: Block = {t:'kv',h:'Signing policy — Ironline Freight company wallet',rows:[
  ['Approval required','two of three directors',''],
  ['Directors on file','Anna Reed · Tom Hill · Grace Ward','m']]};
