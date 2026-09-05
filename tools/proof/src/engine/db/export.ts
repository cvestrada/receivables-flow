import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openProofDb } from './connection.js';
import { toSlug, dedupeSlugsWithinParent } from '../slug.util.js';
import type { StepStatus, Sponsor, TestResultStatus } from './types.js';

export interface JourneyCategory { id: string; name: string; order: number }
export interface JourneyUser { id: string; name: string; categoryId: string; order: number }
export interface JourneyJourney {
  id: string;
  userId: string;
  name: string;
  slug: string;
  cadence: 'one_time' | 'repeating';
  order: number;
}
export interface JourneyPhase { id: string; journeyId: string; name: string; slug: string; order: number }
export interface JourneyMilestone { id: string; phaseId: string; name: string; slug: string; order: number }
export interface JourneyGoal { id: string; milestoneId: string; statement: string; slug: string; order: number }
export interface JourneyStep {
  id: string;
  goalId: string;
  trigger: string;
  action: string;
  outcome: string;
  status: StepStatus;
  order: number;
  sponsor: Sponsor | null;
  whyStack: string;
  requirement: string;
  extraPoints: string | null;
  whyWins: string;
}
export interface JourneyConcern { id: string; stepId: string; thought: string | null; painPoint: string | null; opportunity: string | null }
export interface JourneyCapability {
  id: string;
  /** the real code behind a capability is scoped to the goal it fulfills, not any one
   *  step -- a multi-step goal's steps can (and often do) share one real code path. */
  goalId: string | null;
  name: string;
  patternName: string | null;
  /** JSON-encoded ProofPattern[] — parse before use */
  activityPatterns: string | null;
  /** JSON-encoded ProofLogicChain[] — parse before use */
  logicChains: string | null;
  /** which of detectPatterns()'s own codebase-wide pattern ids this capability's real
   *  diagram was resolved from — null for a capability with no real code behind it at all. */
  claimedPatternId: string | null;
  /** Hand-authored Mermaid `flowchart` source -- when set, the FE renders this single
   *  diagram directly instead of the mechanical Architecture/Logic (Raw)/Logic
   *  (Interpreted) columns built from node/edge rows. */
  diagram: string | null;
}
export interface JourneyNode {
  id: string;
  capabilityId: string;
  layer: string;
  kind: string | null;
  label: string;
  sublabel: string | null;
  path: string | null;
  method: string | null;
  status: string;
  order: number;
}
export interface JourneyEdge { id: string; sourceNodeId: string; targetNodeId: string }
/** A real test's own pass/fail result against one step -- see TestResultTable's own
 *  comment in types.ts for why this stays independent of a step's own hand-typed status. */
export interface JourneyTestResult {
  id: string;
  stepId: string;
  status: TestResultStatus;
  /** the real test file this result came from, an absolute path (same convention node.path already uses) */
  testFilePath: string;
  /** the line the specific it()/test() block starts on, when known */
  testLine: number | null;
  ranAt: string;
}

export interface JourneyData {
  categories: JourneyCategory[];
  users: JourneyUser[];
  journeys: JourneyJourney[];
  phases: JourneyPhase[];
  milestones: JourneyMilestone[];
  goals: JourneyGoal[];
  steps: JourneyStep[];
  concerns: JourneyConcern[];
  capabilities: JourneyCapability[];
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  testResults: JourneyTestResult[];
}

/** Reads the proof app's own database and writes a flat JSON snapshot the FE can fetch —
 *  the same pattern generate.ts already uses for proof.json, one level removed since this
 *  database is real and persistent rather than rebuilt from scratch every run. */
export async function exportJourneyData(dbPath?: string): Promise<JourneyData> {
  const db = openProofDb(dbPath);
  const phases = await db.selectFrom('phase').select(['id', 'journey_id as journeyId', 'name', 'order']).execute();
  const milestones = await db.selectFrom('milestone').select(['id', 'phase_id as phaseId', 'name', 'order']).execute();
  const goals = await db.selectFrom('goal').select(['id', 'milestone_id as milestoneId', 'statement', 'order']).execute();
  const phaseSlugs = dedupeSlugsWithinParent(phases, (phase) => phase.journeyId, (phase) => toSlug(phase.name));
  const milestoneSlugs = dedupeSlugsWithinParent(milestones, (milestone) => milestone.phaseId, (milestone) => toSlug(milestone.name));
  const goalSlugs = dedupeSlugsWithinParent(goals, (goal) => goal.milestoneId, (goal) => toSlug(goal.statement));
  const data: JourneyData = {
    categories: await db.selectFrom('category').select(['id', 'name', 'order']).execute(),
    users: await db.selectFrom('user').select(['id', 'name', 'category_id as categoryId', 'order']).execute(),
    journeys: await db.selectFrom('journey').select(['id', 'user_id as userId', 'name', 'slug', 'cadence', 'order']).execute(),
    /** slug is derived here, not stored -- it's a pure function of the phase's own name,
     *  so keeping it computed instead of persisted means the URL scheme can never drift
     *  out of sync with what's actually displayed on screen. Deduped within each parent
     *  so two siblings that happen to share a name (e.g. two "Review" milestones under
     *  one phase) never collide onto the same, only-one-reachable slug. */
    phases: phases.map((phase, i) => ({ ...phase, slug: phaseSlugs[i] })),
    milestones: milestones.map((milestone, i) => ({ ...milestone, slug: milestoneSlugs[i] })),
    goals: goals.map((goal, i) => ({ ...goal, slug: goalSlugs[i] })),
    steps: await db.selectFrom('step').select(['id', 'goal_id as goalId', 'trigger', 'action', 'outcome', 'status', 'order', 'sponsor', 'why_stack as whyStack', 'requirement', 'extra_points as extraPoints', 'why_wins as whyWins']).execute(),
    concerns: await db.selectFrom('concern').select(['id', 'step_id as stepId', 'thought', 'pain_point as painPoint', 'opportunity']).execute(),
    capabilities: await db.selectFrom('capability').select(['id', 'goal_id as goalId', 'name', 'pattern_name as patternName', 'activity_patterns as activityPatterns', 'logic_chains as logicChains', 'claimed_pattern_id as claimedPatternId', 'diagram']).execute(),
    nodes: await db.selectFrom('node').select(['id', 'capability_id as capabilityId', 'layer', 'kind', 'label', 'sublabel', 'path', 'method', 'status', 'order']).execute(),
    edges: await db.selectFrom('edge').select(['id', 'source_node_id as sourceNodeId', 'target_node_id as targetNodeId']).execute(),
    testResults: await db.selectFrom('test_result').select(['id', 'step_id as stepId', 'status', 'test_file_path as testFilePath', 'test_line as testLine', 'ran_at as ranAt']).execute(),
  };
  await db.destroy();
  return data;
}

/** pathToFileURL, not a plain `file://` template string -- process.argv[1] uses OS-native
 *  path separators (backslashes on Windows), which a raw template string comparison
 *  against import.meta.url's forward-slash URL would never match. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = await exportJourneyData();
  const outPath = path.resolve(import.meta.dirname, '../../../public/journey.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`wrote: ${outPath}`);
}
