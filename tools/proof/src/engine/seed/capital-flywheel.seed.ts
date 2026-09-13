import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportJourneyData } from '../db/export.js';
import { insertSeed } from './seed.type.js';
import type { SeedResult } from './seed.type.js';

/**
 * One journey: the money going round once.
 *
 * This board used to hold two — Ironline's and Woodgrove's — which is the right shape for
 * designing a product and the wrong shape for demonstrating one. A judge watching four
 * minutes does not want two app tours; they want to watch capital leave an investor, reach
 * a business, and come back having made the next loan cheaper. Business and fund and staff
 * are all still here, but as actors inside one cycle rather than as journeys of their own,
 * which is why every step's action names who is acting.
 *
 * The cycle closes rather than ends: phase five's last step changes the price phase two
 * quotes, so the same business borrowing again is the point of the whole thing, not an
 * epilogue.
 *
 * Every column that was about how the work is done is gone — which stack, which bar it
 * clears, which test asserts it. This board answers what happens and to whom, in order. A
 * step's own status says whether it is real yet, and where to look for the proof is a
 * question for the repository rather than for the map.
 */
export function seedCapitalFlywheelJourney(): SeedResult {
  return {
    /*
     * A pseudo-actor, not a person: it stands for the system, the same device Orbbit's own
     * proof tool uses for its capital cycle. Reading across three screens is exactly what
     * no single actor's journey could do.
     */
    users: [{ id: 'capital-flywheel', name: 'capital-flywheel', categoryId: 'receivables-flow', order: 1 }],

    journeys: [
      { id: 'flywheel-journey', userId: 'capital-flywheel', name: 'Complete A Capital Cycle', slug: 'capital-cycle', cadence: 'repeating', order: 1 },
    ],

    phases: [
      { id: 'flywheel-phase-sign-in', journeyId: 'flywheel-journey', name: 'Sign In Both Sides', order: 1 },
      { id: 'flywheel-phase-source', journeyId: 'flywheel-journey', name: 'Source Invoice', order: 2 },
      { id: 'flywheel-phase-fund', journeyId: 'flywheel-journey', name: 'Fund Invoice', order: 3 },
      { id: 'flywheel-phase-resell', journeyId: 'flywheel-journey', name: 'Sell Part To Another Investor', order: 4 },
      { id: 'flywheel-phase-collect', journeyId: 'flywheel-journey', name: 'Collect Repayment', order: 5 },
      { id: 'flywheel-phase-reprice', journeyId: 'flywheel-journey', name: 'Reprice The Capital Cost', order: 6 },
    ],

    /*
     * One milestone per phase, and one goal saying the same thing.
     *
     * A phase that carried two milestones was a phase doing two jobs, and on a board read in
     * four minutes that reads as two things to explain. The phase name is the job; the goal
     * states it in the words of whoever is doing it; the steps are what happens.
     */
    milestones: [
      { id: 'flywheel-milestone-sign-in', phaseId: 'flywheel-phase-sign-in', name: 'Sign both sides in and read the record behind each name', order: 1 },
      { id: 'flywheel-milestone-source', phaseId: 'flywheel-phase-source', name: 'Submit an invoice, see what it costs, and have it tokenized', order: 1 },
      { id: 'flywheel-milestone-fund', phaseId: 'flywheel-phase-fund', name: 'Fund the invoice: Privy approves the money, Hedera moves the asset', order: 1 },
      { id: 'flywheel-milestone-resell', phaseId: 'flywheel-phase-resell', name: 'Sell half to a second investor on day 20', order: 1 },
      { id: 'flywheel-milestone-collect', phaseId: 'flywheel-phase-collect', name: 'Repay on day 60 and pay every holder its share', order: 1 },
      { id: 'flywheel-milestone-reprice', phaseId: 'flywheel-phase-reprice', name: "Let that outcome price the business's next invoice", order: 1 },
    ],

    goals: [
      { id: 'flywheel-goal-sign-in', milestoneId: 'flywheel-milestone-sign-in', statement: 'Sign both sides in and read the record behind each name', order: 1 },
      { id: 'flywheel-goal-source', milestoneId: 'flywheel-milestone-source', statement: 'Submit an invoice, see what it costs, and have it tokenized', order: 1 },
      { id: 'flywheel-goal-fund', milestoneId: 'flywheel-milestone-fund', statement: 'Fund the invoice: Privy approves the money, Hedera moves the asset', order: 1 },
      { id: 'flywheel-goal-resell', milestoneId: 'flywheel-milestone-resell', statement: 'Sell half to a second investor on day 20', order: 1 },
      { id: 'flywheel-goal-collect', milestoneId: 'flywheel-milestone-collect', statement: 'Repay on day 60 and pay every holder its share', order: 1 },
      { id: 'flywheel-goal-reprice', milestoneId: 'flywheel-milestone-reprice', statement: "Let that outcome price the business's next invoice", order: 1 },
    ],

    steps: [
      /*
       * Every step here is a thing that happens on screen and changes what the next step can
       * do. Anything that only illustrated a point was cut: the demo is four minutes long, and
       * a step a judge cannot act on is a step they have to sit through.
       */

      // ── Sign In Both Sides ─────────────────────────────────────── 0:00–0:30
      {
        id: 'flywheel-step-business-signs-in', goalId: 'flywheel-goal-sign-in', order: 1, status: 'built', sponsor: 'privy',
        trigger: 'a freight company wants to finance an invoice and holds no key',
        action: "The judge signs in to the business portal with their own email and the six-digit code Privy sends it, and is seated as Ironline Freight's third director",
        outcome: 'they can now approve what the company wallet does — one of the two signatures it takes — which is what makes this a demo anyone can run rather than watch',
      },
      {
        id: 'flywheel-step-business-record', goalId: 'flywheel-goal-sign-in', order: 2, status: 'built', sponsor: 'ensv2',
        trigger: 'the portal names the company instead of showing a wallet address',
        action: 'Clicking the name opens ironline.business.receivablesflow.eth/records — six invoices financed here and all six settled: 4 paid on time, 2 late, none defaulted',
        outcome: 'the history everything after this is priced from is public, and nobody had to ask us for it',
      },
      {
        id: 'flywheel-step-investor-signs-in', goalId: 'flywheel-goal-sign-in', order: 3, status: 'built', sponsor: 'privy',
        trigger: 'a fund wants short, secured returns and holds no key either',
        action: 'The same judge signs in to the investor portal in the next tab, as Woodgrove Capital',
        outcome: "no seat is needed on this side: the fund's wallet is governed by a mandate rather than by signatures, so it refuses what breaks the rules no matter who is signed in",
      },
      {
        id: 'flywheel-step-investor-record', goalId: 'flywheel-goal-sign-in', order: 4, status: 'built', sponsor: 'ensv2',
        trigger: 'the fund is named on its own screen the same way',
        action: 'Clicking it opens woodgrove.investor.receivablesflow.eth/records — the standing that decides whether it may hold a receivable',
        outcome: 'both sides are public names with public records before a single dollar moves',
      },

      // ── Source Invoice ────────────────────────────────────────── 0:30–1:30
      {
        id: 'flywheel-step-submit', goalId: 'flywheel-goal-source', order: 1, status: 'partially_built', sponsor: null,
        trigger: 'the invoice is sent and Northwind has 60 days to pay it',
        action: 'Ironline submits INV-2026-0417.pdf for financing — $50,000 from Northwind Supplies, payable 4 November',
        outcome: 'the request is the document itself, openable from the portal',
      },
      {
        id: 'flywheel-step-quote', goalId: 'flywheel-goal-source', order: 2, status: 'built', sponsor: 'ensv2',
        trigger: 'the platform has to answer what that invoice is worth today',
        action: 'It is priced off Ironline’s ENS record on the spot: 83 of 100 pays 0.067% a day — 4.02% over 60 days, so 60 days costs $2,010 and Ironline would receive $47,990',
        outcome: 'the business sees the cost of the money before it commits to anything',
      },
      {
        id: 'flywheel-step-propose', goalId: 'flywheel-goal-source', order: 3, status: 'built', sponsor: 'privy',
        trigger: 'the company wallet takes two signatures of the three seats on it',
        action: "Ironline's own finance system signs the financing — one signature of the two, and never enough on its own",
        outcome: 'what the wallet is still waiting for is a person',
      },
      {
        id: 'flywheel-step-second-signature', goalId: 'flywheel-goal-source', order: 4, status: 'built', sponsor: 'privy',
        trigger: 'the judge holds the third seat on that wallet',
        action: 'They press Approve, their browser signs, and the two signatures go to Privy together — which counts them and sends the transaction',
        outcome: 'nothing we wrote decided the sale was allowed; sending one signature is refused by the same button',
      },
      {
        id: 'flywheel-step-tokenize', goalId: 'flywheel-goal-source', order: 5, status: 'partially_built', sponsor: 'hedera-ats',
        trigger: 'the approval is in',
        action: 'The invoice becomes RCV-0001 on Hedera — a token only investors the platform has KYC-approved can hold',
        outcome: 'the claim now exists apart from Ironline, and whoever holds it on 4 November is owed the $50,000',
      },

      // ── Fund Invoice ──────────────────────────────────────────── 1:30–2:10
      {
        id: 'flywheel-step-mandate', goalId: 'flywheel-goal-fund', order: 1, status: 'built', sponsor: 'privy',
        trigger: 'the fund is asked to put $47,990 into this invoice',
        action: "Privy checks it against the mandate written on the fund's wallet — under the $100,000 cap, above the 60 of 100 floor, on the rated list — and signs",
        outcome: 'nothing in our code decides this; a breach is refused by the wallet itself, and the reason on screen is Privy’s own words',
      },
      {
        id: 'flywheel-step-settle', goalId: 'flywheel-goal-fund', order: 2, status: 'partially_built', sponsor: 'hedera',
        trigger: 'the payment is authorised and the invoice has to change hands',
        action: 'On Hedera, the settlement contract moves both sides at once — $47,990 to Ironline, RCV-0001 to Woodgrove — or neither moves',
        outcome: 'nobody is paid without delivering, and nobody delivers without being paid',
      },
      {
        id: 'flywheel-step-schedule', goalId: 'flywheel-goal-fund', order: 3, status: 'built', sponsor: 'hedera',
        trigger: 'the sale is done and repayment is sixty days away',
        action: 'The repayment is scheduled on Hedera at the moment of sale, timed for day 60',
        outcome: 'maturity runs on its own, with nobody to remind and nothing to chase',
      },

      // ── Sell Part To Another Investor ──────────────────────────── 2:20–2:50
      {
        id: 'flywheel-step-resell', goalId: 'flywheel-goal-resell', order: 1, status: 'built', sponsor: 'hedera-ats',
        trigger: 'on day 20 Woodgrove wants some of its money back without waiting for day 60',
        action: 'Woodgrove sells half the invoice to Bridgeline Partners, another approved investor, and keeps the other half',
        outcome: 'two investors now hold half each, and the invoice itself says so',
      },
      {
        id: 'flywheel-step-resale-price', goalId: 'flywheel-goal-resell', order: 2, status: 'built', sponsor: 'ensv2',
        trigger: 'the half being sold has to have a price',
        action: 'Same score, same rate — only 40 days are left instead of 60, so Bridgeline pays $24,025 for $25,000 due on day 60',
        outcome: 'Woodgrove has $24,025 back on day 20 and still holds $25,000 of face value',
      },

      // ── Collect Repayment ──────────────────────────────────────── 3:05–3:35
      {
        id: 'flywheel-step-repay', goalId: 'flywheel-goal-collect', order: 1, status: 'built', sponsor: 'hedera',
        trigger: 'day 60 arrives and the customer has paid',
        action: 'Northwind pays the invoice, Ironline repays the $50,000, and each holder is paid its half with its own transaction',
        outcome: 'the split follows whoever the invoice says holds it, and nobody has to claim anything',
      },

      // ── Reprice The Capital Cost ───────────────────────────────── 3:35–4:00
      {
        id: 'flywheel-step-reprice', goalId: 'flywheel-goal-reprice', order: 1, status: 'built', sponsor: 'ensv2',
        trigger: 'the day-60 outcome is settled either way',
        action: 'The outcome is written back to Ironline’s ENS records — paid on time goes from 4 to 5, and the score from 83 to 86 — so its next invoice is quoted at a smaller discount; not paying does the reverse',
        outcome: 'this invoice set the price of the next one, and the cycle starts again',
      },
    ],

    /** The board renders no Thoughts / Pain Points / Opportunities rows, so a concern has
     *  nowhere to appear. Left empty rather than seeded-and-invisible. */
    concerns: [],

    /** Which spec asserts a step is written on the step itself, in words. This array is
     *  for real run results, and nothing here runs the suite, so it stays empty rather
     *  than claiming passes nobody watched. */
    testResults: [],
  };
}

/** pathToFileURL, not a plain `file://` template string — process.argv[1] uses OS-native
 *  path separators, which a raw template comparison against import.meta.url would miss. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = seedCapitalFlywheelJourney();
  await insertSeed(result);
  console.log(
    `Seeded capital flywheel: ${result.journeys.length} journey | ${result.phases.length} phases | ${result.milestones.length} milestones | ${result.goals.length} goals | ${result.steps.length} steps`,
  );

  const journey = await exportJourneyData();
  const outPath = path.resolve(import.meta.dirname, '../../../public/journey.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(journey, null, 2), 'utf-8');
  console.log(`wrote: ${outPath}`);
}
