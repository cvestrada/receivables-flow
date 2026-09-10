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

export const NAV: NavItem[] = [
  {id:'overview',   label:'Overview',    sub:'Where the fund’s capital sits today'},
  {id:'market',     label:'Marketplace', sub:'Receivables offered to this fund'},
  {id:'portfolio',  label:'Portfolio',   sub:'Positions the fund holds'},
  {id:'compliance', label:'Compliance',  sub:'The fund’s pass, its mandate, and every transfer checked'}
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
    ['Expires',pass.expiresOn,'']],
    note:'Read live from ENS on Sepolia. The pass lapses on its own and can be withdrawn at any time. It is <b>useless to anyone Woodgrove hands it to</b>.'};
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
  ['Maximum maturity','90 days','']],
  note:'These are the fund’s own rules, enforced at signing. An allocation that breaks them <b>will not sign at all</b>.'};

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
      [{v:'0xB0D3…14FF',cls:'id'},{v:'Unidentified wallet',cls:'dim'},{chip:'Refused',tone:'bad'},{v:'No eligibility pass',cls:'bad'}]],
    note:'The check runs <b>inside the transfer</b>, against the pass as it stands at that instant — not against a list someone approved last week. An unapproved buyer is turned away even going around this portal.'};
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
      [{v:'0xB0D3…14FF',cls:'id'},{v:'Unidentified wallet',cls:'dim'},{chip:'Refused',tone:'bad'},{v:'No eligibility pass',cls:'bad'}]],
    note:'The secondary buyer was checked exactly the same way as the first. Resale does not open a side door.'};
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
{ day:'Day 0', label:'Invoice raised', counts:{market:0,portfolio:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder','$250,000','','available to deploy'],
      ['Deployed','$0','dim','no positions'],
      ['Realised return','$0','dim','since inception']]},
    {t:'feed',h:'Activity',items:[
      ['Day 0',`Eligibility pass issued to <b>${pass.name}</b> — expires ${pass.expiresOn}`,'ok'],
      ['Day 0',`Mandate written in — $100,000 cap, ${SCORE_FLOOR} of 100 score floor, 90-day maximum`,'']]}],
  market:[{t:'empty',h:'Marketplace',title:'No offers match your mandate',
    text:`Receivables appear here once a verified business scoring ${SCORE_FLOOR} of 100 or better issues one.`}],
  portfolio:[{t:'empty',h:'Portfolio',title:'No positions held',
    text:'Funded receivables appear here with their maturity date and expected payout.'}],
  compliance:[PASS,MANDATE]}},

{ day:'Day 0', label:'Approved', counts:{market:0,portfolio:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder','$250,000','','available to deploy'],
      ['Deployed','$0','dim','no positions'],
      ['Realised return','$0','dim','since inception']]},
    {t:'feed',h:'Activity',items:[
      ['Day 0',`Eligibility pass issued to <b>${pass.name}</b> — expires ${pass.expiresOn}`,'ok'],
      ['Day 0',`Mandate written in — $100,000 cap, ${SCORE_FLOOR} of 100 score floor, 90-day maximum`,'']]},
    {t:'kv',h:'Nothing changed here',rows:[
      ['Offers visible to the fund','0',''],
      ['Positions held','0','']],
      note:'Ironline’s directors are approving the sale on their own side right now. The fund <b>cannot see any of it</b>, and should not — it only ever sees a receivable once it exists.'}],
  market:[{t:'empty',h:'Marketplace',title:'No offers match your mandate',
    text:`Receivables appear here once a verified business scoring ${SCORE_FLOOR} of 100 or better issues one.`}],
  portfolio:[{t:'empty',h:'Portfolio',title:'No positions held',
    text:'Funded receivables appear here with their maturity date and expected payout.'}],
  compliance:[PASS,MANDATE]}},

{ day:'Day 1', label:'Issued', counts:{market:1,portfolio:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder','$250,000','','available to deploy'],
      ['Deployed','$0','dim','no positions'],
      ['Realised return','$0','dim','since inception']]},
    {t:'feed',h:'Activity',items:[
      ['Day 1',`<b>RCV-0001</b> listed — Ironline Freight, credit score ${score.label}, $47,500 for $50,000`,'hot'],
      ['Day 0',`Eligibility pass issued — expires ${pass.expiresOn}`,'ok']]}],
  market:[
    {t:'table',h:'Offered to this fund',head:['Receivable','Issuer','Credit score','Pay','Collect','Matures','Mandate'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight',score.label,{v:'$47,500',cls:'strong'},'$50,000','2026-11-04',{chip:'Within mandate',tone:'ok'}]],
      note:`<b>5.3% on cost</b> over 58 days. Ironline’s <b>${score.label}</b> is not a grade anyone assigned — it is the share of its matured invoices that were repaid, ${score.live ? 'read from ENS on Sepolia' : 'computed from the counts on its public profile'} and recomputable by anyone. Inside the $100,000 cap and above the ${SCORE_FLOOR} of 100 floor.`}],
  portfolio:[{t:'empty',h:'Portfolio',title:'No positions held',
    text:'Fund RCV-0001 and it appears here.'}],
  compliance:[PASS,MANDATE]}},

{ day:'Day 2', label:'Funded', counts:{market:0,portfolio:1}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder','$202,500','','after this allocation'],
      ['Deployed','$47,500','','1 position'],
      ['Owed at maturity','$50,000','pos','on 2026-11-04']]},
    {t:'feed',h:'Activity',items:[
      ['11:26','Funded RCV-0001 — <b>$47,500</b> paid to Ironline Freight','ok'],
      ['11:26','Transfer accepted — eligibility pass checked at the moment of purchase','ok'],
      ['Day 1',`RCV-0001 listed — Ironline Freight, credit score ${score.label}`,'hot']]}],
  market:[{t:'empty',h:'Marketplace',title:'No open offers',
    text:'RCV-0001 has been funded. New receivables appear here as businesses issue them.'}],
  portfolio:[
    {t:'table',h:'Positions held',head:['Receivable','Issuer','Held','Cost','At maturity','Matures','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight','100.00%',{v:'$47,500',cls:'strong'},'$50,000','2026-11-04',{chip:'Funded',tone:'ok'}]],
      note:'The payout was booked at the moment of sale. Nothing needs to be claimed on day 60.'}],
  compliance:[LOG3,PASS]}},

{ day:'Day 20', label:'Half resold', counts:{market:0,portfolio:1}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder',dryPowderAfterSale,'pos','cash back on day 20'],
      ['Deployed',atRisk,'','half the position'],
      ['Owed at maturity','$25,000','','on 2026-11-04']]},
    {t:'feed',h:'Activity',items:[
      ['Day 20',`Sold <b>${soldAway}</b> to ${buyer?.name ?? 'a second approved investor'} for <b>${cashBack}</b>`,'ok'],
      ['Day 20','Buyer checked at the moment of transfer — accepted','ok'],
      ['11:26','Funded RCV-0001 — $47,500 paid to Ironline Freight','ok']]},
    {t:'kv',h:'Why sell half',rows:[
      ['Cash back',cashBack,''],
      ['Days early','40',''],
      ['Still at risk',atRisk,'']],
      note:`Exiting early is the thing ordinary factoring cannot do. Being able to means the discount demanded on day 2 can be <b>smaller in the first place</b>. ${source(split)}`}],
  market:[{t:'empty',h:'Marketplace',title:'No open offers',
    text:'New receivables appear here as businesses issue them.'}],
  portfolio:[
    {t:'table',h:'Positions held',head:['Receivable','Issuer','Held','Cost','At maturity','Matures','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight',share(held?.sharePct ?? 0),{v:atRisk,cls:'strong'},'$25,000','2026-11-04',{chip:'Funded',tone:'ok'}]],
      note:source(split)}],
  compliance:[LOG4,PASS]}},

{ day:'Day 60', label:'Settled', counts:{market:0,portfolio:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder',dryPowderAtMaturity,'pos','position closed'],
      ['Deployed','$0','dim','nothing outstanding'],
      ['Realised return',realised,'pos','on $47,500 deployed']]},
    {t:'feed',h:'Activity',items:[
      ['Day 60','Position closed. Nothing was claimed, signed, or pressed.','ok'],
      ['Day 60','Distribution received — <b>$25,000</b> for 5000 bps held','ok'],
      ['Day 60','Northwind Brokerage paid Ironline Freight’s invoice in full','ok']]},
    {t:'kv',h:'How the return was made',rows:[
      ['Paid on day 2','−$47,500',''],
      ['Recovered on day 20',cashBack,'ok'],
      ['Paid at maturity','$25,000','ok'],
      ['Net',realised,'ok']]}],
  market:[{t:'empty',h:'Marketplace',title:'No open offers',
    text:'New receivables appear here as businesses issue them.'}],
  portfolio:[
    {t:'table',h:'Positions held',head:['Receivable','Issuer','Held','Cost','Received','Settled','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight',share(held?.sharePct ?? 0),atRisk,{v:'$25,000',cls:'ok'},'2026-11-04',{chip:'Redeemed',tone:'ok'}]]}],
  compliance:[LOG4,PASS]}}
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
  return { day:'Day 60', label:'Defaulted', counts:{market:0,portfolio:0}, sections:{
  overview:[
    {t:'tiles',items:[
      ['Dry powder',dryPowderAfterSale,'','nothing recovered at maturity'],
      ['Deployed','$0','dim','position written off'],
      ['Realised return',`−${atRisk}`,'neg','on $47,500 deployed']]},
    {t:'feed',h:'Activity',items:[
      ['Day 60','RCV-0001 marked <b>defaulted</b> — the loss is the fund’s','bad'],
      ['Day 60','Northwind Brokerage did not pay','bad'],
      ['Day 20',`Sold ${buyer ? bps(buyer.sharePct) : bps(0)} to ${buyer?.name ?? 'a second approved investor'} for ${cashBack}`,'ok']]},
    {t:'kv',h:'How the loss landed',flag:true,rows:[
      ['Paid on day 2','−$47,500',''],
      ['Recovered on day 20',cashBack,'ok'],
      ['Paid at maturity','$0','bad'],
      ['Net',`−${atRisk}`,'bad']],
      note:`Selling half on day 20 is the only reason this is <b>−${atRisk}</b> and not −$47,500. ${buyer?.name ?? 'The second investor'}, who bought in later and held to maturity, is down ${cashBack}. Liquidity was worth something.`}],
  market:[{t:'empty',h:'Marketplace',title:'No open offers',
    text:'New receivables appear here as businesses issue them.'}],
  portfolio:[
    {t:'table',h:'Positions held',head:['Receivable','Issuer','Held','Cost','Received','Settled','Status'],
      rows:[[{v:'RCV-0001',cls:'id'},'Ironline Freight',share(held?.sharePct ?? 0),atRisk,{v:'$0',cls:'bad'},{v:'—',cls:'dim'},{chip:'Defaulted',tone:'bad'}]],
      note:'This is what buying a receivable actually means. A demo that only shows the happy ending is not showing it.'}],
  compliance:[LOG4,PASS]}};
}
