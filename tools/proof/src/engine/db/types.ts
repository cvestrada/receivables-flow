import type { Generated } from 'kysely';

/**
 * Hand-written to match schema.sql.ts exactly (Kanel targets a live Postgres database;
 * this schema is SQLite, so its shape is kept in sync by hand -- 10 small, stable tables).
 */

export interface CategoryTable {
  id: string;
  name: string;
  order: number;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface UserTable {
  id: string;
  category_id: string;
  name: string;
  order: number;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export type Cadence = 'one_time' | 'repeating';

export interface JourneyTable {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  cadence: Cadence;
  order: number;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface PhaseTable {
  id: string;
  journey_id: string;
  name: string;
  order: number;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface MilestoneTable {
  id: string;
  phase_id: string;
  name: string;
  order: number;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface GoalTable {
  id: string;
  milestone_id: string;
  statement: string;
  order: number;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Which sponsor's technology does the work in a step. Replaces the proof tool's own
 *  PerformedBy: this board tracks which stack is exercised, not who presses the button.
 *  'hedera' is Hedera-native work that is not ATS (scheduled transactions, settlement). */
export type Sponsor = 'hedera-ats' | 'hedera' | 'privy' | 'ensv2';
export type StepStatus = 'built' | 'partially_built' | 'proposed';
/** Who or what actually carries out this step, verified against the real code behind it,
 *  never guessed from its name -- 'automated' covers both the real system acting on its
 *  own and real end-user self-service (no Orbbit operational burden); 'staff-in-app' means
 *  a real Orbbit staff member acts through a real screen in one of Orbbit's own apps (e.g.
 *  HQ's own review/decision screens); 'staff-outside-app' means a real Orbbit staff member
 *  acts somewhere Orbbit doesn't own (e.g. a manual USDC send via the Coinbase Business
 *  Account, GTM outreach to a prospective investor or business). null means this hasn't
 *  been classified yet, or -- confirmed by reading the real code, not assumed -- no real
 *  mechanism (automated or staff-driven, in-app or outside it) exists for this step at all
 *  today; see the specific step's own seed-file comment for which case applies. */

export interface StepTable {
  id: string;
  goal_id: string;
  trigger: string;
  action: string;
  outcome: string;
  status: Generated<StepStatus>;
  order: number;
  sponsor: Sponsor | null;
  why_stack: string;
  requirement: string;
  extra_points: string | null;
  why_wins: string;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

/** A real test's own pass/fail result against one step -- separate from step.status
 *  (a person's hand-typed claim). Never read from or written by anything involving
 *  step.status -- the claimed status and the proven status stay two independent signals. */
export type TestResultStatus = 'passed' | 'failed';

export interface TestResultTable {
  id: string;
  step_id: string;
  status: TestResultStatus;
  /** the real test file this result came from, an absolute path (same convention
   *  node.path already uses) -- "passed" means nothing on its own unless a reader can
   *  open the actual test and read it. */
  test_file_path: string;
  /** the line the specific it()/test() block starts on, when known. */
  test_line: number | null;
  ran_at: string;
}

export interface ConcernTable {
  id: string;
  step_id: string;
  thought: string | null;
  pain_point: string | null;
  opportunity: string | null;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface CapabilityTable {
  id: string;
  /** the real code behind a capability is scoped to the goal it fulfills, not any one
   *  step -- a multi-step goal's steps can (and often do) share one real code path. */
  goal_id: string | null;
  name: string;
  pattern_name: string | null;
  /** JSON-encoded ProofPattern[] -- parse before use */
  activity_patterns: string | null;
  /** JSON-encoded ProofLogicChain[] -- parse before use */
  logic_chains: string | null;
  /** which of detectPatterns()'s own codebase-wide pattern ids this capability's real
   *  diagram was resolved from -- null for a capability with no real code behind it at all. */
  claimed_pattern_id: string | null;
  /** Hand-authored Mermaid `flowchart` source -- when set, this single diagram overrides
   *  the mechanical node/edge-built Architecture/Logic (Raw)/Logic (Interpreted) columns.
   *  Subgraphs are real system layers (FE, BFF, Domain, DB, Temporal, Webhook Processor,
   *  Onchain); each layer's box shows both its real connections and its own real logic. */
  diagram: string | null;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export type Layer =
  | 'fe'
  | 'bff'
  | 'webhook'
  | 'temporal-workflow'
  | 'temporal-child'
  | 'temporal'
  | 'wait'
  | 'domain'
  | 'domain-service'
  | 'repository'
  | 'integration-adapter'
  | 'external-api'
  | 'db'
  | 'smart_contract';

export type NodeStatus = 'present' | 'inferred';

export interface NodeTable {
  id: string;
  capability_id: string;
  layer: Layer;
  kind: string | null;
  label: string;
  sublabel: string | null;
  path: string | null;
  method: string | null;
  status: Generated<NodeStatus>;
  order: number;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface EdgeTable {
  id: string;
  source_node_id: string;
  target_node_id: string;
  created_at: Generated<string>;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface ProofDatabase {
  category: CategoryTable;
  user: UserTable;
  journey: JourneyTable;
  phase: PhaseTable;
  milestone: MilestoneTable;
  goal: GoalTable;
  step: StepTable;
  test_result: TestResultTable;
  concern: ConcernTable;
  capability: CapabilityTable;
  node: NodeTable;
  edge: EdgeTable;
}
