import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportJourneyData } from '../db/export.js';
import { insertSeed } from './seed.type.js';
import type { SeedResult } from './seed.type.js';

/**
 * The institutional investor's side — one journey, start to finish.
 *
 * Same convention as business.seed.ts: each step names the sponsor doing the work, the
 * bar it clears, and why it beats a minimum submission. Becoming eligible is four steps
 * rather than one, because the wallet, the mandate policy, the ENS clearance and the ATS
 * KYC grant are four separate writes to three separate systems, and collapsing them hid
 * both the mandate control and the ATS half of the compliance story.
 *
 * Two steps carry most of the prize weight. The transfer at funding is the compliance-check
 * lifecycle operation the Hedera demo video needs, and it has to be a real on-chain revert
 * rather than a disabled button. The secondary sale is the thing ATS does not ship today,
 * which is the first item on that track's extra-points list.
 *
 * Every step is `proposed`. Nothing is built yet — see tools/proof/README.md.
 */
export function seedInvestorJourney(): SeedResult {
  return {
    users: [{ id: 'investor', name: 'investor', categoryId: 'receivables-flow', order: 2 }],

    journeys: [
      { id: 'investor-journey-fund-and-exit', userId: 'investor', name: 'Fund And Exit A Receivable', slug: 'fund-and-exit-a-receivable', cadence: 'repeating', order: 1 },
    ],

    phases: [
      { id: 'investor-phase-get-cleared', journeyId: 'investor-journey-fund-and-exit', name: 'Get Cleared', order: 1 },
      { id: 'investor-phase-fund', journeyId: 'investor-journey-fund-and-exit', name: 'Fund', order: 2 },
      { id: 'investor-phase-exit', journeyId: 'investor-journey-fund-and-exit', name: 'Exit', order: 3 },
    ],

    milestones: [
      { id: 'investor-milestone-become-eligible', phaseId: 'investor-phase-get-cleared', name: "Get approved to invest and set the fund's own limits on what it can buy", order: 1 },
      { id: 'investor-milestone-buy', phaseId: 'investor-phase-fund', name: "Buy an unpaid invoice at a discount", order: 1 },
      { id: 'investor-milestone-sell-early', phaseId: 'investor-phase-exit', name: "Sell part of it early instead of waiting for the due date", order: 1 },
      { id: 'investor-milestone-collect', phaseId: 'investor-phase-exit', name: "Get paid when the invoice is settled", order: 2 },
    ],

    goals: [
      { id: 'investor-goal-clearance', milestoneId: 'investor-milestone-become-eligible', statement: "Get approved to invest and set the fund's own limits on what it can buy", order: 1 },
      { id: 'investor-goal-buy', milestoneId: 'investor-milestone-buy', statement: "Buy an unpaid invoice at a discount", order: 1 },
      { id: 'investor-goal-early-exit', milestoneId: 'investor-milestone-sell-early', statement: "Sell part of it early instead of waiting for the due date", order: 1 },
      { id: 'investor-goal-collect', milestoneId: 'investor-milestone-collect', statement: "Get paid when the invoice is settled", order: 1 },
    ],

    steps: [
      // ── Get Cleared ──────────────────────── Privy, then ENSv2, then Hedera ATS
      {
        id: 'investor-step-wallet', goalId: 'investor-goal-clearance', order: 1, status: 'proposed', sponsor: 'privy',
        trigger: "a fund has cash sitting idle and wants short, secured returns",
        action: "Signs up and is ready to invest, with no crypto wallet to install",
        outcome: "the fund can buy and get paid without anyone handling a seed phrase",
        whyStack: "A fund invests without anyone handling a seed phrase.",
        requirement: "Create or use at least one Privy wallet",
        whyWins: "One control plane serves a small carrier and an institutional fund.",
      },
      {
        id: 'investor-step-mandate-policy', goalId: 'investor-goal-clearance', order: 2, status: 'proposed', sponsor: 'privy',
        trigger: "the fund's investment rules live in a document nobody checks in time",
        action: "Writes the fund's rules in: never more than $100,000 on one invoice, never below a B rating",
        outcome: "an investment that breaks the fund's own rules simply will not go through",
        whyStack: "The fund's own rules block the trade instead of catching it next week.",
        requirement: "Use at least one Privy control, such as policies, signers, key quorums, or intents",
        extraPoints: "Privy names: policies and automated transactions",
        whyWins: "On camera: an allocation over mandate is refused.",
      },
      {
        id: 'investor-step-eligibility-subname', goalId: 'investor-goal-clearance', order: 3, status: 'proposed', sponsor: 'ensv2',
        trigger: "only approved investors are allowed to own these invoices",
        action: "Woodgrove is issued an approval pass with an expiry date",
        outcome: "the pass lapses on its own, can be withdrawn, and is useless to anyone Woodgrove hands it to",
        whyStack: "Approval that expires, can be withdrawn, and cannot be passed on.",
        requirement: "ENSv2 features should be central to the product, not a cosmetic add-on",
        extraPoints: "Expiring, revocable and non-transferable subnames",
        whyWins: "Three named ENSv2 features in one name, each true of real KYC.",
      },
      {
        id: 'investor-step-kyc-grant', goalId: 'investor-goal-clearance', order: 4, status: 'proposed', sponsor: 'hedera-ats',
        trigger: "the invoice itself has to recognise the pass",
        action: "The approval pass is copied across to where the invoices are held",
        outcome: "Woodgrove can now be handed an invoice",
        whyStack: "The invoice itself has to recognise the approval to enforce it.",
        requirement: "Use the Asset Tokenization Studio (SDK, contracts, web application, or a combination) to issue or manage a tokenised asset",
        extraPoints: "Compliance controls in use: KYC grants, freezes, transfer restrictions, pauses",
        whyWins: "The cross-chain hop is the integration, not a gap.",
      },

      // ── Fund ─────────────────────────── Hedera ATS compliance, then Hedera settlement
      {
        id: 'investor-step-transfer-check', goalId: 'investor-goal-buy', order: 1, status: 'proposed', sponsor: 'hedera-ats',
        trigger: "Woodgrove goes to buy Ironline Freight's invoice",
        action: "Woodgrove is checked at the moment of purchase, not beforehand",
        outcome: "an approved buyer receives it; anyone else is refused, even going around the app",
        whyStack: "The rule applies on every route in, including apps we did not build.",
        requirement: "Demo video of five minutes or less showing issuance, configuration, and at least one lifecycle operation such as a transfer, compliance check, or distribution",
        extraPoints: "Compliance controls in use: KYC grants, freezes, transfer restrictions, pauses",
        whyWins: "Reverts on-chain — a front-end gate is worth nothing to a regulated buyer.",
      },
      {
        id: 'investor-step-settle', goalId: 'investor-goal-buy', order: 2, status: 'proposed', sponsor: 'hedera',
        trigger: "the check passed",
        action: "Pays $47,500 and takes ownership of the invoice",
        outcome: "Ironline Freight has cash today; Woodgrove is owed $50,000 in 60 days",
        whyStack: "Predictable settlement cost, when the whole margin is a small discount.",
        requirement: "Deploy and demonstrate on Hedera testnet",
        whyWins: "A testnet transaction a judge can open.",
      },

      // ── Exit ──────────────── secondary market over ATS, then ATS distribution
      {
        id: 'investor-step-list-secondary', goalId: 'investor-goal-early-exit', order: 1, status: 'proposed', sponsor: 'hedera-ats',
        trigger: "Woodgrove wants its cash back before day 60",
        action: "Puts half the invoice up for sale to other approved investors",
        outcome: "the half is on offer without waiting for the broker to pay",
        whyStack: "A half-share sells on without losing the rule about who may own it.",
        requirement: "Use the Asset Tokenization Studio (SDK, contracts, web application, or a combination) to issue or manage a tokenised asset",
        extraPoints: "A secondary market for ATS-issued assets, which the Studio does not have today",
        whyWins: "First item on the track's own extra-points list; ATS ships nothing like it.",
      },
      {
        id: 'investor-step-secondary-fill', goalId: 'investor-goal-early-exit', order: 2, status: 'proposed', sponsor: 'hedera-ats',
        trigger: "another approved investor takes the offer",
        action: "That half changes hands, with the new buyer checked the same way",
        outcome: "Woodgrove has cash back on day 20, and the invoice now has two owners",
        whyStack: "The rule survives a sale we had nothing to do with.",
        requirement: "Demo video of five minutes or less showing issuance, configuration, and at least one lifecycle operation such as a transfer, compliance check, or distribution",
        extraPoints: "A secondary market for ATS-issued assets, which the Studio does not have today",
        whyWins: "Resale is where restricted assets normally leak.",
      },
      {
        id: 'investor-step-collect', goalId: 'investor-goal-collect', order: 1, status: 'proposed', sponsor: 'hedera-ats',
        trigger: "day 60 arrives and the broker has paid",
        action: "Both owners are paid their share without either of them doing anything",
        outcome: "each is paid in proportion to the piece they hold",
        whyStack: "Both owners paid correctly after the invoice was split.",
        requirement: "Demo video of five minutes or less showing issuance, configuration, and at least one lifecycle operation such as a transfer, compliance check, or distribution",
        extraPoints: "Custom fee schedules, coupon or dividend distributions, royalty flows",
        whyWins: "Two owners after the split, both paid correctly.",
      },
    ],

    /** The board no longer renders Thoughts / Pain Points / Opportunities, so concerns
     *  have nowhere to appear. Left empty rather than seeded-and-invisible. */
    concerns: [],

    testResults: [],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = seedInvestorJourney();
  await insertSeed(result);
  console.log(
    `Seeded investor: ${result.journeys.length} journeys | ${result.phases.length} phases | ${result.milestones.length} milestones | ${result.goals.length} goals | ${result.steps.length} steps | ${result.concerns.length} concerns`,
  );

  const journey = await exportJourneyData();
  const outPath = path.resolve(import.meta.dirname, '../../../public/journey.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(journey, null, 2), 'utf-8');
  console.log(`wrote: ${outPath}`);
}
