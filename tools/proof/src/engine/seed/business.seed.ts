import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportJourneyData } from '../db/export.js';
import { insertSeed } from './seed.type.js';
import type { SeedResult } from './seed.type.js';

/**
 * Ironline Freight's side — one journey, start to finish.
 *
 * Set Up runs once per business rather than once per invoice, so strictly it has a
 * different cadence from the two phases after it. Kept inside the single journey anyway,
 * because a judge watching a five-minute video should see one unbroken line from "this
 * company has no wallet" to "the holders were paid" — and the phase name already says
 * which part they only do once.
 *
 * Each step carries the sponsor whose technology does the work, the qualification bar it
 * clears, the listed extra-points item it hits (where it hits one), and why it beats a
 * minimum submission. No step depends on two sponsors at once — where that was true it is
 * split into two steps instead.
 *
 * Every step is `proposed`. Nothing is built yet — see tools/proof/README.md.
 */
export function seedBusinessJourney(): SeedResult {
  return {
    users: [{ id: 'business', name: 'business', categoryId: 'receivables-flow', order: 1 }],

    journeys: [
      { id: 'business-journey-issue-and-settle', userId: 'business', name: 'Issue And Settle A Receivable', slug: 'issue-and-settle-a-receivable', cadence: 'repeating', order: 1 },
    ],

    phases: [
      { id: 'business-phase-set-up', journeyId: 'business-journey-issue-and-settle', name: 'Set Up', order: 1 },
      { id: 'business-phase-issue', journeyId: 'business-journey-issue-and-settle', name: 'Issue', order: 2 },
      { id: 'business-phase-settle', journeyId: 'business-journey-issue-and-settle', name: 'Settle', order: 3 },
    ],

    milestones: [
      { id: 'business-milestone-company-wallet', phaseId: 'business-phase-set-up', name: "Open a company account and decide which employees can approve what", order: 1 },
      { id: 'business-milestone-issuer-identity', phaseId: 'business-phase-set-up', name: "Get a public business profile with a credit rating buyers can check", order: 2 },
      { id: 'business-milestone-approve-and-issue', phaseId: 'business-phase-issue', name: "Sell an unpaid invoice and get the cash today instead of in 60 days", order: 1 },
      { id: 'business-milestone-schedule-settlement', phaseId: 'business-phase-issue', name: "Know the payout will happen on the due date without chasing anyone", order: 2 },
      { id: 'business-milestone-maturity', phaseId: 'business-phase-settle', name: "Build a track record that makes the next invoice cheaper to sell", order: 1 },
    ],

    goals: [
      { id: 'business-goal-two-signatures', milestoneId: 'business-milestone-company-wallet', statement: "Open a company account and decide which employees can approve what", order: 1 },
      { id: 'business-goal-credit-tier-onchain', milestoneId: 'business-milestone-issuer-identity', statement: "Get a public business profile with a credit rating buyers can check", order: 1 },
      { id: 'business-goal-compliant-token', milestoneId: 'business-milestone-approve-and-issue', statement: "Sell an unpaid invoice and get the cash today instead of in 60 days", order: 1 },
      { id: 'business-goal-settles-itself', milestoneId: 'business-milestone-schedule-settlement', statement: "Know the payout will happen on the due date without chasing anyone", order: 1 },
      { id: 'business-goal-pay-and-record', milestoneId: 'business-milestone-maturity', statement: "Build a track record that makes the next invoice cheaper to sell", order: 1 },
    ],

    steps: [
      // ── Set Up ─────────────────────────────────────────────── Privy, then ENSv2
      {
        id: 'business-step-org-wallet', goalId: 'business-goal-two-signatures', order: 1, status: 'proposed', sponsor: 'privy',
        trigger: "Ironline Freight needs an account for the business, not for a person",
        action: "Opens the company account that holds Ironline Freight's money",
        outcome: "the money belongs to the company, not to whoever happened to set it up",
        whyStack: "The company owns the money, not the employee who set it up.",
        requirement: "Create or use at least one Privy wallet",
        whyWins: "Signs as a company, not as one person's key.",
      },
      {
        id: 'business-step-quorum-policy', goalId: 'business-goal-two-signatures', order: 2, status: 'proposed', sponsor: 'privy',
        trigger: "one employee acting alone could sell an invoice that does not exist",
        action: "Decides who can sell an invoice: the office manager up to $10,000, two directors above that",
        outcome: "small invoices move without fuss, big ones need a second person to agree",
        whyStack: "Different limits for different staff on one account.",
        requirement: "Use at least one Privy control, such as policies, signers, key quorums, or intents",
        extraPoints: "Privy names: policies and team permissions",
        whyWins: "An org chart, not a single multisig.",
      },
      {
        id: 'business-step-register-subname', goalId: 'business-goal-credit-tier-onchain', order: 1, status: 'proposed', sponsor: 'ensv2',
        trigger: "investors will not fund a company they have never heard of",
        action: "Claims a public business profile at ironline.receivables.eth",
        outcome: "anyone can look Ironline Freight up before deciding to fund them",
        whyStack: "Reputation the business carries anywhere, not locked in our database.",
        requirement: "Project must be built on ENSv2 (Sepolia)",
        extraPoints: "Your own subname registry, run under your own rules",
        whyWins: "The record outlives the relationship with us.",
      },
      {
        id: 'business-step-delegate-credit-tier', goalId: 'business-goal-credit-tier-onchain', order: 2, status: 'proposed', sponsor: 'ensv2',
        trigger: "a rating anyone can write by hand is worth nothing",
        action: "Publishes the raw counts and lets every reader compute the score from a published formula",
        outcome: "Ironline Freight can never raise its own score, and nor can we — there is no score record to write",
        whyStack: "They own the profile; the score is arithmetic over what the chain already saw.",
        requirement: "ENSv2 features should be central to the product, not a cosmetic add-on",
        extraPoints: "Enhanced Access Control — a role scoped to one text record",
        whyWins: "On camera: the business tries to edit the counts behind its score and is refused.",
      },

      // ── Issue ──────────────────────────────── Privy quorum, then Hedera ATS, then Hedera
      {
        id: 'business-step-quorum-approval', goalId: 'business-goal-compliant-token', order: 1, status: 'proposed', sponsor: 'privy',
        trigger: "a freight broker owes Ironline Freight $50,000 on 60-day terms",
        action: "Two directors approve the sale from their phones, hours apart",
        outcome: "the sale goes ahead on its own the moment the second approval lands",
        whyStack: "Approvals collected from people who are never online together.",
        requirement: "Implement at least one functional B2B workflow, such as a payment, approval, treasury operation, or wallet administration flow",
        extraPoints: "Privy names: quorum approvals and intents",
        whyWins: "Timestamps hours apart — most teams demo both approvals ten seconds apart.",
      },
      {
        id: 'business-step-ats-issue', goalId: 'business-goal-compliant-token', order: 2, status: 'proposed', sponsor: 'hedera-ats',
        trigger: "the invoice is approved for sale",
        action: "The invoice becomes something an investor can buy: $50,000, payable in 60 days",
        outcome: "the claim on that invoice now exists on its own, separate from Ironline Freight",
        whyStack: "An invoice with a due date and holder rules; a plain token has neither.",
        requirement: "Use the Asset Tokenization Studio (SDK, contracts, web application, or a combination) to issue or manage a tokenised asset",
        whyWins: "A real due date and a real obligor, not a token with a name on it.",
      },
      {
        id: 'business-step-ats-compliance', goalId: 'business-goal-compliant-token', order: 3, status: 'proposed', sponsor: 'hedera-ats',
        trigger: "at this point anyone at all could buy it",
        action: "Locks the invoice so only approved investors can ever own it",
        outcome: "an unapproved buyer is turned away even if they try to go around the app",
        whyStack: "The rule lives in the invoice, so it holds outside our app.",
        requirement: "Demo video of five minutes or less showing issuance, configuration, and at least one lifecycle operation such as a transfer, compliance check, or distribution",
        extraPoints: "Compliance controls in use: KYC grants, freezes, transfer restrictions, pauses",
        whyWins: "The refusal is visible on HashScan, not a greyed-out button.",
      },
      {
        id: 'business-step-schedule-redemption', goalId: 'business-goal-settles-itself', order: 1, status: 'proposed', sponsor: 'hedera',
        trigger: "payday is 60 days out and nobody should have to remember it",
        action: "Books the day-60 payout now, at the moment of sale",
        outcome: "the payout happens on its own, even if Ironline Freight and this app are both long gone",
        whyStack: "The payout fires even if we no longer exist.",
        requirement: "Deploy and demonstrate on Hedera testnet",
        extraPoints: "Scheduled Transactions for vesting, coupon payments, or maturity settlement",
        whyWins: "Settlement cannot be forgotten; it was booked at the sale.",
      },

      // ── Settle ─────────────────────────────────────── Hedera ATS, then ENSv2
      {
        id: 'business-step-redeem', goalId: 'business-goal-pay-and-record', order: 1, status: 'proposed', sponsor: 'hedera-ats',
        trigger: "day 60 arrives and the broker has paid",
        action: "Everyone who owns a piece of the invoice is paid their share",
        outcome: "the $50,000 reaches whoever owns it that day, split correctly",
        whyStack: "Pays whoever owns it on the day, split correctly.",
        requirement: "Demo video of five minutes or less showing issuance, configuration, and at least one lifecycle operation such as a transfer, compliance check, or distribution",
        extraPoints: "Custom fee schedules, coupon or dividend distributions, royalty flows",
        whyWins: "A real corporate action at maturity, not a one-shot mint.",
      },
      {
        id: 'business-step-write-history', goalId: 'business-goal-pay-and-record', order: 2, status: 'proposed', sponsor: 'ensv2',
        trigger: "the invoice was paid on time",
        action: "Ironline Freight's public profile gains one more invoice paid on time",
        outcome: "the next invoice sells at a better rate because of it",
        whyStack: "A funder who has never used us can check the record.",
        requirement: "Your demo must be functional and not just include hard-coded values",
        whyWins: "Written by the redemption, read back to price the next sale.",
      },
    ],

    /** The board no longer renders Thoughts / Pain Points / Opportunities, so concerns
     *  have nowhere to appear. Left empty rather than seeded-and-invisible. */
    concerns: [],

    /** No real tests exist yet, so no step can honestly claim a result. The board renders
     *  "Not yet tested" until this array points at real files. */
    testResults: [],
  };
}

/** pathToFileURL, not a plain `file://` template string — process.argv[1] uses OS-native
 *  path separators, which a raw template comparison against import.meta.url would miss. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = seedBusinessJourney();
  await insertSeed(result);
  console.log(
    `Seeded business: ${result.journeys.length} journeys | ${result.phases.length} phases | ${result.milestones.length} milestones | ${result.goals.length} goals | ${result.steps.length} steps | ${result.concerns.length} concerns`,
  );

  const journey = await exportJourneyData();
  const outPath = path.resolve(import.meta.dirname, '../../../public/journey.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(journey, null, 2), 'utf-8');
  console.log(`wrote: ${outPath}`);
}
