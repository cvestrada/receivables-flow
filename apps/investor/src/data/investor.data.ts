import type { EligibilityPass, Holding } from '@rf/shared';
import type { PassView } from '@/lib/ens/pass';
import type { ScoreView } from '@/lib/ens/score';
import type { HolderView, ResaleView } from '@/lib/hedera-ats/resale';
import type { Block, Cell, NavItem, Stage } from './portal.types';

/*
 * The fund's side of the same deal, stated once in the shared domain vocabulary.
 * Nothing on the portal renders from these two objects. They exist so that a type
 * change made in one of the chain lanes breaks this build, rather than letting the
 * portal drift out of agreement with the contract it is standing in for.
 */
export const PASS_RECORD: EligibilityPass = {
  holder: '0x7C41000000000000000000000000000000009AE2',
  name: 'woodgrove.receivables.eth',
  expiresAt: '2026-12-31',
};

export const HOLDING: Holding = {
  receivableId: 'RCV-0001',
  holder: '0x7C41000000000000000000000000000000009AE2',
  shareBps: 5000,
};

/*
 * Three tabs, mirroring the business's three.
 *
 * Marketplace and Portfolio were one receivable at two moments of its life — offered, then held
 * — exactly as Invoices and Receivables were on the other side, so they are one tab. What is
 * left is the rule that governs them, which is the mandate, and it earns a tab of its own
 * because it is the thing that refuses.
 */
export const NAV: NavItem[] = [
  {id:'portfolio',   label:'Portfolio',   href:'/portfolio'},
  {id:'mandate',     label:'Mandate',     href:'/mandate'}
];

/*
 * The one block on this portal that is not written down here. Every row comes from the
 * registry on Sepolia, so the screen and the chain cannot disagree about whether this fund
 * may hold a receivable today.
 */
function passBlock(pass: PassView): Block {
  return {t:'kv',h:'Eligibility pass',rows:[
    ['Holder',pass.name,'m'],
    ['Wallet',pass.wallet,'m'],
    ['Status',pass.cleared ? 'Valid' : 'Lapsed',pass.cleared ? 'ok' : 'bad'],
    ['Expires',pass.expiresOn,'']]};
}

const SCORE_FLOOR = 60;

/** What the fund had to deploy before it funded anything. */
const DRY_POWDER_USD = 250_000;

/** What it paid Ironline Freight for the whole receivable on day 2. */
const FUNDED_USD = 47_500;

/** Face value of the half it keeps to maturity. */
const HALF_FACE_USD = 25_000;

const MANDATE: Block = {t:'kv',h:'Fund mandate',rows:[
  ['Maximum per position','$100,000',''],
  ['Minimum credit score',`${SCORE_FLOOR} of 100`,''],
  ['Maximum maturity','90 days','']]};

/** A wallet as a compliance officer reads it — enough to recognise, short enough to scan. */
function short(wallet: string): string {
  return wallet.startsWith('0x') ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
}

/** Money as the portal states it — whole dollars, grouped. */
function money(usd: number): string {
  return `$${Math.round(usd).toLocaleString('en-US')}`;
}

/** A share to two places, so a position that is nearly half does not read as exactly half. */
function share(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

/** The same share said the way a trading desk says it — hundredths of a percent. */
function bps(pct: number): string {
  return `${Math.round(pct * 100)} bps`;
}

/**
 * Where the day-20 figures came from, said on the screen that shows them.
 *
 * A split the portal could not refresh is still worth showing, but a fund has to be able to
 * tell it apart from one that is current — otherwise the panel makes the same claim either way.
 */
function source(split: ResaleView): string {
  return split.live
    ? 'Read from the receivable on Hedera testnet — units held, share and cash back are the chain’s figures, not ours.'
    : 'Not live — the balances on hand, shown because the Hedera endpoint could not be reached. Nothing here was typed into the page.';
}

/*
 * Woodgrove's row in the transfer log carries the same wallet and the same date as the pass
 * above it, both taken from the registry. A log that quoted a different date would be claiming
 * the transfer was checked against something other than the pass the fund actually holds.
 */
function woodgroveRow(pass: PassView): Cell[] {
  return [
    {v:short(pass.wallet),cls:'id'},
    'Woodgrove Capital',
    pass.cleared ? {chip:'Accepted',tone:'ok'} : {chip:'Refused',tone:'bad'},
    pass.cleared ? {v:`Pass valid to ${pass.expiresOn}`,cls:'ok'} : {v:'Pass lapsed',cls:'bad'},
  ];
}

function log3(pass: PassView): Block {
  return {t:'table',h:'Transfer log — checked at the moment of purchase',flag:true,
    head:['Wallet','Party','Result','Reason'],
    rows:[
      woodgroveRow(pass),
      [{v:'0xB0D3…14FF',cls:'id'},{v:'Unidentified wallet',cls:'dim'},{chip:'Refused',tone:'bad'},{v:'No eligibility pass',cls:'bad'}]]};
}

/*
 * The buyer's row is the chain's own answer about the resale: a party appears here because the
 * receivable's balances say it holds part of it, not because a row was written for it.
 */
function buyerRow(buyer: HolderView): Cell[] {
  return [
    {v:short(buyer.wallet),cls:'id'},
    buyer.name,
    {chip:'Accepted',tone:'ok'},
    {v:`Holds ${share(buyer.sharePct)} of the receivable`,cls:'ok'},
  ];
}

function log4(pass: PassView, split: ResaleView): Block {
  const buyer = split.holders[1];
  return {t:'table',h:'Transfer log — checked at the moment of purchase',flag:true,
    head:['Wallet','Party','Result','Reason'],
    rows:[
      ...(buyer ? [buyerRow(buyer)] : []),
      woodgroveRow(pass),
      [{v:'0xB0D3…14FF',cls:'id'},{v:'Unidentified wallet',cls:'dim'},{chip:'Refused',tone:'bad'},{v:'No eligibility pass',cls:'bad'}]]};
}

export function buildStages(pass: PassView, score: ScoreView, split: ResaleView): Stage[] {
  const PASS = passBlock(pass);
  const LOG3 = log3(pass);
  const LOG4 = log4(pass, split);

  /*
   * Who holds what after the day-20 sale, as the receivable's balances report it. The fund is
   * always the first holder; the second is whoever bought in, and there may not be one yet.
   */
  const held = split.holders[0];
  const buyer = split.holders[1];
  const soldAway = buyer ? bps(buyer.sharePct) : bps(0);
  const cashBack = money(split.cashReturnedUsd);

  /*
   * Every figure that follows the resale is worked out from what the sale actually returned.
   * The price is no longer written down here — it comes off Ironline's record and the days
   * left on the invoice — so a tile carrying its own copy would disagree with the sale beside
   * it the first time that record moved.
   */
  const atRisk = money(FUNDED_USD - split.cashReturnedUsd);
  const dryPowderAfterSale = money(DRY_POWDER_USD - FUNDED_USD + split.cashReturnedUsd);
  const dryPowderAtMaturity = money(DRY_POWDER_USD - FUNDED_USD + split.cashReturnedUsd + HALF_FACE_USD);
  const realised = money(split.cashReturnedUsd + HALF_FACE_USD - FUNDED_USD);
  return [
{ day:'Sign In Both Sides', label:'', counts:{portfolio:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder','$250,000','','available to deploy'],
      ['Deployed','$0','dim','no positions'],
      ['Realised return','$0','dim','since inception']]},
    {t:'feed',h:'Activity',items:[
      ['Day 0',`Eligibility pass issued to <b>${pass.name}</b> — expires ${pass.expiresOn}`,'ok'],
      ['Day 0',`Mandate written in — $100,000 cap, ${SCORE_FLOOR} of 100 score floor, 90-day maximum`,'']]},],
  portfolio:[{t:'empty',h:'Portfolio',title:'No offers match your mandate',
    text:`Nothing offered yet.`}],
  mandate:[PASS,MANDATE]}},

{ day:'Source Invoice', label:'', counts:{portfolio:1}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder','$250,000','','available to deploy'],
      ['Deployed','$0','dim','no positions'],
      ['Realised return','$0','dim','since inception']]},
    {t:'feed',h:'Activity',items:[
      ['Day 1',`<b>RCV-0001</b> listed — Ironline Freight, credit score ${score.label}, $47,990 for $50,000`,'hot'],
      ['Day 0',`Eligibility pass issued — expires ${pass.expiresOn}`,'ok']]},],
  portfolio:[
    {t:'table',h:'Offered to this fund',head:['Receivable','Issuer','Credit score','Pay','Collect','Matures','Mandate'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight',score.label,{v:'$47,990',cls:'strong'},'$50,000','2026-11-04',{chip:'Within mandate',tone:'ok'}]]}],
  mandate:[PASS,MANDATE]}},

{ day:'Fund Invoice', label:'', counts:{portfolio:1}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder','$202,010','','after this allocation'],
      ['Deployed','$47,990','','1 position'],
      ['Owed at maturity','$50,000','pos','on 2026-11-04']]},
    {t:'feed',h:'Activity',items:[
      ['11:26','Funded RCV-0001 — <b>$47,990</b> paid to Ironline Freight','ok'],
      ['11:26','Transfer accepted — eligibility pass checked at the moment of purchase','ok'],
      ['Day 1',`RCV-0001 listed — Ironline Freight, credit score ${score.label}`,'hot']]},],
  portfolio:[
    {t:'table',h:'Positions held',head:['Receivable','Issuer','Held','Cost','At maturity','Matures','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight','100.00%',{v:'$47,990',cls:'strong'},'$50,000','2026-11-04',{chip:'Funded',tone:'ok'}]]}],
  mandate:[LOG3,PASS]}},

{ day:'Sell Part To Another Investor', label:'', counts:{portfolio:1}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder',dryPowderAfterSale,'pos','cash back on day 20'],
      ['Deployed',atRisk,'','half the position'],
      ['Owed at maturity','$25,000','','on 2026-11-04']]},
    {t:'feed',h:'Activity',items:[
      ['Day 20',`Sold <b>${soldAway}</b> to ${buyer?.name ?? 'a second approved investor'} for <b>${cashBack}</b>`,'ok'],
      ['Day 20','Buyer checked at the moment of transfer — accepted','ok'],
      ['11:26','Funded RCV-0001 — $47,990 paid to Ironline Freight','ok']]},
    {t:'kv',h:'Why sell half',rows:[
      ['Cash back',cashBack,''],
      ['Days early','40',''],
      ['Still at risk',atRisk,'']]},],
  portfolio:[
    {t:'table',h:'Positions held',head:['Receivable','Issuer','Held','Cost','At maturity','Matures','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight',share(held?.sharePct ?? 0),{v:atRisk,cls:'strong'},'$25,000','2026-11-04',{chip:'Funded',tone:'ok'}]]}],
  mandate:[LOG4,PASS]}},

{ day:'Collect Repayment', label:'', counts:{portfolio:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder',dryPowderAtMaturity,'pos','position closed'],
      ['Deployed','$0','dim','nothing outstanding'],
      ['Realised return',realised,'pos','on $47,990 deployed']]},
    {t:'feed',h:'Activity',items:[
      ['Day 60','Position closed. Nothing was claimed, signed, or pressed.','ok'],
      ['Day 60','Distribution received — <b>$25,000</b> for 5000 bps held','ok'],
      ['Day 60','Northwind Supplies paid Ironline Freight’s invoice in full','ok']]},
    {t:'kv',h:'How the return was made',rows:[
      ['Paid on day 2','−$47,990',''],
      ['Recovered on day 20',cashBack,'ok'],
      ['Paid at maturity','$25,000','ok'],
      ['Net',realised,'ok']]},],
  portfolio:[
    {t:'table',h:'Positions held',head:['Receivable','Issuer','Held','Cost','Received','Settled','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight',share(held?.sharePct ?? 0),atRisk,{v:'$25,000',cls:'ok'},'2026-11-04',{chip:'Redeemed',tone:'ok'}]]}],
  mandate:[LOG4,PASS]}},

/*
 * The seventh phase seen from the buy side: the same record that priced this deal has moved,
 * so the next one Woodgrove is offered is priced differently — and it can see why.
 */
{ day:'Reprice The Capital Cost', label:'', counts:{portfolio:1}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder',dryPowderAtMaturity,'pos','ready for the next one'],
      ['Realised return',realised,'pos','on $47,990 deployed'],
      ['Ironline scores','86 of 100','pos','was 83 before day 60']]},
    {t:'feed',h:'Activity',items:[
      ['Day 60','Ironline Freight paid on time — 7 financed = 5 on time + 2 late + 0 defaulted + 0 outstanding','ok'],
      ['Day 60','The next invoice from Ironline would cost <b>3.84%</b>, not 4.02% — a better business borrows cheaper','']]},
    {t:'kv',h:'What that costs this fund',rows:[
      ['Fee on this deal','4.02%',''],
      ['Fee on the next one','3.84%',''],
      ['Return per $50,000 invoice','$2,010 → $1,920','']]},
    LOG4,
    PASS],
  /*
   * The next offer, on the tab that now holds both what is offered and what is held. It used to
   * sit under a `market` key that no nav entry points at any more, which meant the one screen
   * this phase exists to show rendered nowhere.
   */
  portfolio:[
    {t:'table',h:'Offered to this fund',head:['Receivable','Issuer','Credit score','Price','Face','Matures','Mandate'],
      rows:[[{v:'RCV-0002',cls:'id'},'Ironline Freight','86 of 100',{v:'$48,080',cls:'strong'},'$50,000','2027-01-06',{chip:'Within mandate',tone:'ok'}]]}]}}
  ];
}

export function buildDefaulted(pass: PassView, split: ResaleView): Stage {
  const PASS = passBlock(pass);
  const LOG4 = log4(pass, split);
  const held = split.holders[0];
  const buyer = split.holders[1];
  const cashBack = money(split.cashReturnedUsd);

  /*
   * Every figure that follows the resale is worked out from what the sale actually returned.
   * The price is no longer written down here — it comes off Ironline's record and the days
   * left on the invoice — so a tile carrying its own copy would disagree with the sale beside
   * it the first time that record moved.
   */
  const atRisk = money(FUNDED_USD - split.cashReturnedUsd);
  const dryPowderAfterSale = money(DRY_POWDER_USD - FUNDED_USD + split.cashReturnedUsd);
  const dryPowderAtMaturity = money(DRY_POWDER_USD - FUNDED_USD + split.cashReturnedUsd + HALF_FACE_USD);
  const realised = money(split.cashReturnedUsd + HALF_FACE_USD - FUNDED_USD);
  return { day:'Collect Repayment', label:'defaulted', counts:{portfolio:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder',dryPowderAfterSale,'','nothing recovered at maturity'],
      ['Deployed','$0','dim','position written off'],
      ['Realised return',`−${atRisk}`,'neg','on $47,990 deployed']]},
    {t:'feed',h:'Activity',items:[
      ['Day 60','RCV-0001 marked <b>defaulted</b> — the loss is the fund’s','bad'],
      ['Day 60','Northwind Supplies did not pay','bad'],
      ['Day 20',`Sold ${buyer ? bps(buyer.sharePct) : bps(0)} to ${buyer?.name ?? 'a second approved investor'} for ${cashBack}`,'ok']]},
    {t:'kv',h:'How the loss landed',flag:true,rows:[
      ['Paid on day 2','−$47,990',''],
      ['Recovered on day 20',cashBack,'ok'],
      ['Paid at maturity','$0','bad'],
      ['Net',`−${atRisk}`,'bad']]},],
  portfolio:[
    {t:'table',h:'Positions held',head:['Receivable','Issuer','Held','Cost','Received','Settled','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight',share(held?.sharePct ?? 0),atRisk,{v:'$0',cls:'bad'},{v:'—',cls:'dim'},{chip:'Defaulted',tone:'bad'}]]}],
  mandate:[LOG4,PASS]}};
}
