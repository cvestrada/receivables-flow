import type { Invoice, Receivable } from '@rf/shared';
import type { Block, NavItem, Stage } from './portal.types';

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
  payer: 'Northwind Brokerage',
};

export const RECEIVABLE: Receivable = {
  id: 'RCV-0001',
  invoiceId: 'INV-2026-0417',
  faceValue: '50000.00',
  purchasePrice: '47500.00',
  maturityDate: '2026-11-04',
  status: 'funded',
};

export const NAV: NavItem[] = [
  {id:'overview',    label:'Overview',    sub:'Where the company’s cash stands today'},
  {id:'invoices',    label:'Invoices',    sub:'Bills sent to customers and not yet paid'},
  {id:'receivables', label:'Receivables', sub:'Invoices sold to investors'},
  {id:'approvals',   label:'Approvals',   sub:'Who may sell an invoice, and who has signed'}
];

const POLICY: Block = {t:'kv',h:'Signing policy — Ironline Freight company wallet',rows:[
  ['Approval required','two of three directors',''],
  ['Directors on file','Anna Reed · Tom Hill · Grace Ward','m']],
  note:'Every sale takes two directors, whatever it is worth. One employee acting alone cannot sell an invoice that does not exist.'};

const SIGNED: Block = {t:'table',h:'INV-2026-0417 — approval record',
  head:['Director','Decision','Time','From'],
  rows:[
    [{v:'Anna Reed',cls:'strong'},{chip:'Approved',tone:'ok'},'09:14','Mobile'],
    [{v:'Tom Hill',cls:'strong'},{chip:'Approved',tone:'ok'},'17:02','Mobile'],
    [{v:'Grace Ward',cls:'dim'},{chip:'Not needed',tone:'idle'},{v:'—',cls:'dim'},{v:'—',cls:'dim'}]],
  note:'Quorum met at <b>17:02</b>, eight hours after the first signature. The sale then proceeded on its own — nobody pressed a final button.'};

export const STAGES: Stage[] = [
{ day:'Day 0', label:'Invoice raised', counts:{invoices:1,receivables:0,approvals:1}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Cash available','$0','dim','nothing received yet'],
      ['Owed by customers','$50,000','','1 invoice outstanding'],
      ['Next payroll run','11 days','','$38,400 due']]},
    {t:'feed',h:'Activity',items:[
      ['09:02','Invoice <b>INV-2026-0417</b> raised against Northwind Brokerage — $50,000 on 60-day terms','']]},
    {t:'kv',h:'The problem, in one line',rows:[
      ['Money owed to us','$50,000',''],
      ['Arrives in','60 days',''],
      ['Payroll due in','11 days','bad']],
      note:'The work is done and the bill is sent. Payroll does not wait 60 days.'}],
  invoices:[
    {t:'table',h:'Outstanding invoices',head:['Invoice','Customer','Amount','Due','Terms','Status'],
      rows:[[{v:'INV-2026-0417',cls:'id'},'Northwind Brokerage',{v:'$50,000',cls:'strong'},'2026-11-04','60 days',{chip:'Unpaid',tone:'idle'}]],
      note:'Nothing here can be sold until the finance team approves it.'}],
  receivables:[{t:'empty',h:'Receivables',title:'Nothing sold yet',
    text:'An approved invoice becomes a receivable an investor can buy.'}],
  approvals:[
    {t:'table',h:'Waiting on you',tag:'1 pending',tagTone:'hot',
      head:['Invoice','Amount','Requires','Status'],
      rows:[[{v:'INV-2026-0417',cls:'id'},{v:'$50,000',cls:'strong'},'2 of 3 directors',{chip:'Awaiting signatures',tone:'hot'}]]},
    POLICY]}},

{ day:'Day 0', label:'Approved', counts:{invoices:1,receivables:0,approvals:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Cash available','$0','dim','nothing received yet'],
      ['Owed by customers','$50,000','','1 invoice outstanding'],
      ['Next payroll run','11 days','','$38,400 due']]},
    {t:'feed',h:'Activity',items:[
      ['17:02','Quorum met — <b>2 of 3 directors</b> approved the sale of INV-2026-0417','ok'],
      ['09:14','Anna Reed approved from mobile','ok'],
      ['09:02','Invoice <b>INV-2026-0417</b> raised against Northwind Brokerage — $50,000','']]}],
  invoices:[
    {t:'table',h:'Outstanding invoices',head:['Invoice','Customer','Amount','Due','Terms','Status'],
      rows:[[{v:'INV-2026-0417',cls:'id'},'Northwind Brokerage',{v:'$50,000',cls:'strong'},'2026-11-04','60 days',{chip:'Approved for sale',tone:'hot'}]]}],
  receivables:[{t:'empty',h:'Receivables',title:'Nothing sold yet',
    text:'INV-2026-0417 is approved and will be issued as a receivable next.'}],
  approvals:[SIGNED,POLICY]}},

{ day:'Day 1', label:'Issued', counts:{invoices:1,receivables:1,approvals:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Cash available','$0','dim','awaiting a buyer'],
      ['Owed by customers','$50,000','','claim now sellable'],
      ['Listed for sale','$47,500','','a 5.0% discount']]},
    {t:'feed',h:'Activity',items:[
      ['08:40','Transfer restrictions active — only wallets holding a valid eligibility pass may own it',''],
      ['08:40','<b>RCV-0001</b> issued — $50,000 face value, matures 2026-11-04','hot'],
      ['17:02','Quorum met — 2 of 3 directors approved','ok']]}],
  invoices:[
    {t:'table',h:'Outstanding invoices',head:['Invoice','Customer','Amount','Due','Terms','Status'],
      rows:[[{v:'INV-2026-0417',cls:'id'},'Northwind Brokerage',{v:'$50,000',cls:'strong'},'2026-11-04','60 days',{chip:'Tokenised',tone:'hot'}]]}],
  receivables:[
    {t:'table',h:'Receivables',head:['Receivable','From invoice','Face','Asking','Matures','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},{v:'INV-2026-0417',cls:'id'},{v:'$50,000',cls:'strong'},'$47,500','2026-11-04',{chip:'Issued',tone:'hot'}]],
      note:'The claim now exists separately from Ironline Freight. Whoever holds it on 4 November is owed the <b>$50,000</b>.'}],
  approvals:[SIGNED,POLICY]}},

{ day:'Day 2', label:'Funded', counts:{invoices:0,receivables:1,approvals:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Cash available','$47,500','pos','received 2026-09-07'],
      ['Owed by customers','$0','dim','the claim was sold'],
      ['Cost of funding','$2,500','','5.0% of face']]},
    {t:'feed',h:'Activity',items:[
      ['11:26','<b>Woodgrove Capital</b> funded RCV-0001 — <b>$47,500</b> received','ok'],
      ['11:26','An unidentified wallet attempted the same purchase and was refused','bad'],
      ['08:40','RCV-0001 issued — $50,000 face value','hot']]},
    {t:'kv',h:'What the cash covers',rows:[
      ['Payroll, 18 September','$38,400','ok'],
      ['Fuel and tolls','$6,900','ok'],
      ['Left over','$2,200','']],
      note:'Two months of waiting removed for <b>$2,500</b>.'}],
  invoices:[
    {t:'table',h:'Outstanding invoices',head:['Invoice','Customer','Amount','Due','Terms','Status'],
      rows:[[{v:'INV-2026-0417',cls:'id'},'Northwind Brokerage',{v:'$50,000',cls:'strong'},'2026-11-04','60 days',{chip:'Sold',tone:'ok'}]],
      note:'Northwind still owes the $50,000 on 4 November — it is simply owed to the holder now, not to us.'}],
  receivables:[
    {t:'table',h:'Receivables',head:['Receivable','Face','Sold for','Holder','Matures','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},{v:'$50,000',cls:'strong'},'$47,500','Woodgrove Capital','2026-11-04',{chip:'Funded',tone:'ok'}]]}],
  approvals:[SIGNED,POLICY]}},

{ day:'Day 20', label:'Half resold', counts:{invoices:0,receivables:1,approvals:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Cash available','$47,500','pos','received 2026-09-07'],
      ['Owed by customers','$0','dim','the claim was sold'],
      ['Cost of funding','$2,500','','5.0% of face']]},
    {t:'feed',h:'Activity',items:[
      ['Day 20','Holder of record changed — RCV-0001 now has <b>2 holders</b>',''],
      ['11:26','Woodgrove Capital funded RCV-0001 — $47,500 received','ok']]}],
  invoices:[
    {t:'table',h:'Outstanding invoices',head:['Invoice','Customer','Amount','Due','Terms','Status'],
      rows:[[{v:'INV-2026-0417',cls:'id'},'Northwind Brokerage',{v:'$50,000',cls:'strong'},'2026-11-04','60 days',{chip:'Sold',tone:'ok'}]]}],
  receivables:[
    {t:'table',h:'Receivables',head:['Receivable','Face','Sold for','Holders','Matures','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},{v:'$50,000',cls:'strong'},'$47,500','2','2026-11-04',{chip:'Funded',tone:'ok'}]]},
    {t:'kv',h:'Holders of record',rows:[
      ['Woodgrove Capital','5000 bps · 50.00%','m'],
      ['Bridgeline Partners','5000 bps · 50.00%','m']],
      note:'Ironline is unaffected by the resale. The <b>same $50,000</b> is owed on day 60 to whoever holds it that day.'}],
  approvals:[SIGNED,POLICY]}},

{ day:'Day 60', label:'Settled', counts:{invoices:0,receivables:0,approvals:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Cash available','$47,500','pos','received 2026-09-07'],
      ['Settled at maturity','$50,000','pos','paid 2026-11-04'],
      ['Repayment record','7 of 7','pos','settled on time']]},
    {t:'feed',h:'Activity',items:[
      ['Day 60','Public record updated — credit tier <b>B → B+</b>','ok'],
      ['Day 60','Holders paid automatically — nobody claimed anything','ok'],
      ['Day 60','Northwind Brokerage paid <b>$50,000</b>','ok']]},
    {t:'kv',h:'Public record — ironline.receivables.eth',rows:[
      ['Invoices settled on time','7 of 7','ok'],
      ['Credit tier','B → B+','ok'],
      ['Average discount paid','5.0% → 4.4%','ok']],
      note:'The next invoice sells at a tighter discount because of this line — and Ironline earned it from <b>its own history</b>, not from a relationship with one lender.'}],
  invoices:[
    {t:'table',h:'Outstanding invoices',head:['Invoice','Customer','Amount','Due','Terms','Status'],
      rows:[[{v:'INV-2026-0417',cls:'id'},'Northwind Brokerage',{v:'$50,000',cls:'strong'},'2026-11-04','60 days',{chip:'Settled',tone:'ok'}]]}],
  receivables:[
    {t:'table',h:'Receivables',head:['Receivable','Face','Sold for','Holders','Settled','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},{v:'$50,000',cls:'strong'},'$47,500','2','2026-11-04',{chip:'Redeemed',tone:'ok'}]]}],
  approvals:[SIGNED,POLICY]}}
];

export const DEFAULTED: Stage = { day:'Day 60', label:'Defaulted', counts:{invoices:1,receivables:0,approvals:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Cash available','$47,500','pos','kept — the sale was final'],
      ['Settled at maturity','$0','neg','no payment received'],
      ['Repayment record','7 of 8','neg','one missed']]},
    {t:'feed',h:'Activity',items:[
      ['Day 60','Public record updated — credit tier <b>B → C</b>','bad'],
      ['Day 60','RCV-0001 marked <b>defaulted</b> — the holders absorb the loss','bad'],
      ['Day 60','Northwind Brokerage did not pay','bad']]},
    {t:'kv',h:'Public record — ironline.receivables.eth',flag:true,rows:[
      ['Invoices settled on time','7 of 8','bad'],
      ['Credit tier','B → C','bad'],
      ['Expected discount, next sale','5.0% → 8.5%','bad']],
      note:'Ironline keeps the $47,500 — the sale was final and the loss is the holders’. What Ironline loses is <b>the price of its next one</b>.'}],
  invoices:[
    {t:'table',h:'Outstanding invoices',head:['Invoice','Customer','Amount','Due','Terms','Status'],
      rows:[[{v:'INV-2026-0417',cls:'id'},'Northwind Brokerage',{v:'$50,000',cls:'strong'},'2026-11-04','60 days',{chip:'Unpaid',tone:'bad'}]],
      note:'Recovery from Northwind is now a collections matter, and it does not change what the holders lost.'}],
  receivables:[
    {t:'table',h:'Receivables',head:['Receivable','Face','Sold for','Holders','Outcome','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},{v:'$50,000',cls:'strong'},'$47,500','2',{v:'$0 paid',cls:'bad'},{chip:'Defaulted',tone:'bad'}]]}],
  approvals:[SIGNED,POLICY]}};
