import type { Transaction } from 'kysely';
import { openProofDb } from '../db/connection.js';
import type { ProofDatabase } from '../db/types.js';
import { CATEGORIES } from './category.constant.js';

/**
 * The seed contract every actor's own seed file writes against, plus the single writer
 * that puts a SeedResult into the database.
 *
 * Orbbit's own proof tool keeps these types and `insertSeed` inside business.seed.ts and
 * has the other actors import from it, which makes Business the accidental owner of a
 * shared contract. Split out here instead: `business.seed.ts` and `investor.seed.ts` are
 * peers, and neither imports the other.
 */

export interface SeedUser {
  id: string;
  name: string;
  categoryId: string;
  /** order among sibling actors within the same category — Business, then Investor. */
  order: number;
}

export type JourneyCadence = 'one_time' | 'repeating';

export interface SeedJourney {
  id: string;
  userId: string;
  name: string;
  slug: string;
  cadence: JourneyCadence;
  order: number;
}

export interface SeedPhase {
  id: string;
  journeyId: string;
  name: string;
  order: number;
}

export interface SeedMilestone {
  id: string;
  phaseId: string;
  name: string;
  order: number;
}

export interface SeedGoal {
  id: string;
  milestoneId: string;
  statement: string;
  order: number;
}

export type StepStatus = 'built' | 'partially_built' | 'proposed';
/** Which sponsor's technology does the work in this step. */
export type Sponsor = 'hedera-ats' | 'hedera' | 'privy' | 'ensv2';

export interface SeedStep {
  id: string;
  goalId: string;
  trigger: string;
  action: string;
  outcome: string;
  /** "built" = verified against real code in this repo. "partially_built" = the core path
   *  is real but the stated outcome isn't fully met yet. "proposed" = a design target with
   *  no code behind it. Everything here is `proposed` until the build starts. */
  status: StepStatus;
  /** a goal's steps run in this order */
  order: number;
  /** whose stack does the work here — the badge on the step card */
  sponsor: Sponsor;
  /** why this technology is the right tool for THIS job — the answer to "why not just a
   *  row in your own database". Naming the stack is not a justification; this field is. */
  whyStack: string;
  /** the stated qualification requirement this step clears, kept close to the track's own
   *  wording so a reader can match it against the brief without interpreting anything */
  requirement: string;
  /** the listed "extra points" item this step hits. Omit it for a step that only clears a
   *  mandatory bar — an empty value is the honest answer, not a gap to fill with padding. */
  extraPoints?: string;
  /** why this beats a minimum submission: the demo moment, or the thing most teams will
   *  not have. The column that is about winning rather than passing. */
  whyWins: string;
}

export interface SeedConcern {
  id: string;
  stepId: string;
  thought: string;
  painPoint: string;
  opportunity: string;
}

export type TestResultStatus = 'passed' | 'failed';

export interface SeedTestResult {
  id: string;
  stepId: string;
  status: TestResultStatus;
  /** absolute path to the real test file, so a reader can open it from this checkout.
   *  "passed" means nothing without a test someone can go read. */
  testFilePath: string;
  testLine?: number;
  ranAt: string;
}

export interface SeedResult {
  users: SeedUser[];
  journeys: SeedJourney[];
  phases: SeedPhase[];
  milestones: SeedMilestone[];
  goals: SeedGoal[];
  steps: SeedStep[];
  concerns: SeedConcern[];
  testResults: SeedTestResult[];
}

/** Clears one actor's own rows before reseeding, so a rename or a deleted step actually
 *  disappears instead of accumulating alongside its replacement. Deletes bottom-up, since
 *  every child row is a foreign key onto its parent. The actor's own `user` row is left
 *  alone — insertSeed upserts it. */
async function wipeActorData(trx: Transaction<ProofDatabase>, userId: string): Promise<void> {
  const journeyIds = (await trx.selectFrom('journey').select('id').where('user_id', '=', userId).execute()).map((r) => r.id);
  const phaseIds = journeyIds.length
    ? (await trx.selectFrom('phase').select('id').where('journey_id', 'in', journeyIds).execute()).map((r) => r.id)
    : [];
  const milestoneIds = phaseIds.length
    ? (await trx.selectFrom('milestone').select('id').where('phase_id', 'in', phaseIds).execute()).map((r) => r.id)
    : [];
  const goalIds = milestoneIds.length
    ? (await trx.selectFrom('goal').select('id').where('milestone_id', 'in', milestoneIds).execute()).map((r) => r.id)
    : [];
  const stepIds = goalIds.length
    ? (await trx.selectFrom('step').select('id').where('goal_id', 'in', goalIds).execute()).map((r) => r.id)
    : [];
  const capabilityIds = goalIds.length
    ? (await trx.selectFrom('capability').select('id').where('goal_id', 'in', goalIds).execute()).map((r) => r.id)
    : [];
  const nodeIds = capabilityIds.length
    ? (await trx.selectFrom('node').select('id').where('capability_id', 'in', capabilityIds).execute()).map((r) => r.id)
    : [];

  if (nodeIds.length) {
    await trx.deleteFrom('edge').where((eb) => eb.or([eb('source_node_id', 'in', nodeIds), eb('target_node_id', 'in', nodeIds)])).execute();
    await trx.deleteFrom('node').where('id', 'in', nodeIds).execute();
  }
  if (capabilityIds.length) await trx.deleteFrom('capability').where('id', 'in', capabilityIds).execute();
  if (stepIds.length) {
    await trx.deleteFrom('test_result').where('step_id', 'in', stepIds).execute();
    await trx.deleteFrom('concern').where('step_id', 'in', stepIds).execute();
    await trx.deleteFrom('step').where('id', 'in', stepIds).execute();
  }
  if (goalIds.length) await trx.deleteFrom('goal').where('id', 'in', goalIds).execute();
  if (milestoneIds.length) await trx.deleteFrom('milestone').where('id', 'in', milestoneIds).execute();
  if (phaseIds.length) await trx.deleteFrom('phase').where('id', 'in', phaseIds).execute();
  if (journeyIds.length) await trx.deleteFrom('journey').where('id', 'in', journeyIds).execute();
}

export async function insertSeed(result: SeedResult): Promise<void> {
  const db = openProofDb();

  await db.transaction().execute(async (trx) => {
    for (const user of result.users) {
      await wipeActorData(trx, user.id);
    }
    /** Categories have no seed file of their own, so every seed run upserts all of them —
     *  a category must exist before the user row referencing it, whichever seed runs first. */
    for (const category of CATEGORIES) {
      await trx.insertInto('category').values({ id: category.id, name: category.name, order: category.order })
        .onConflict((oc) => oc.column('id').doUpdateSet({ name: category.name, order: category.order }))
        .execute();
    }
    for (const user of result.users) {
      await trx.insertInto('user').values({ id: user.id, name: user.name, category_id: user.categoryId, order: user.order })
        .onConflict((oc) => oc.column('id').doUpdateSet({ name: user.name, category_id: user.categoryId, order: user.order }))
        .execute();
    }
    for (const journey of result.journeys) {
      await trx.insertInto('journey').values({
        id: journey.id, user_id: journey.userId, name: journey.name, slug: journey.slug, cadence: journey.cadence, order: journey.order,
      }).onConflict((oc) => oc.doNothing()).execute();
    }
    for (const phase of result.phases) {
      await trx.insertInto('phase').values({ id: phase.id, journey_id: phase.journeyId, name: phase.name, order: phase.order }).onConflict((oc) => oc.doNothing()).execute();
    }
    for (const milestone of result.milestones) {
      await trx.insertInto('milestone').values({ id: milestone.id, phase_id: milestone.phaseId, name: milestone.name, order: milestone.order }).onConflict((oc) => oc.doNothing()).execute();
    }
    for (const goal of result.goals) {
      await trx.insertInto('goal').values({ id: goal.id, milestone_id: goal.milestoneId, statement: goal.statement, order: goal.order }).onConflict((oc) => oc.doNothing()).execute();
    }
    for (const step of result.steps) {
      await trx.insertInto('step').values({
        id: step.id, goal_id: step.goalId, trigger: step.trigger, action: step.action, outcome: step.outcome,
        status: step.status, order: step.order, sponsor: step.sponsor,
        why_stack: step.whyStack, requirement: step.requirement, extra_points: step.extraPoints ?? null, why_wins: step.whyWins,
      }).onConflict((oc) => oc.doNothing()).execute();
    }
    for (const concern of result.concerns) {
      await trx.insertInto('concern').values({ id: concern.id, step_id: concern.stepId, thought: concern.thought, pain_point: concern.painPoint, opportunity: concern.opportunity }).onConflict((oc) => oc.doNothing()).execute();
    }
    for (const testResult of result.testResults) {
      await trx.insertInto('test_result').values({
        id: testResult.id, step_id: testResult.stepId, status: testResult.status,
        test_file_path: testResult.testFilePath, test_line: testResult.testLine ?? null, ran_at: testResult.ranAt,
      }).onConflict((oc) => oc.doNothing()).execute();
    }
  });

  await db.destroy();
}
