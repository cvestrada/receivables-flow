/**
 * Hand-translated from ../../schema.hcl (the canonical, documented schema — also what
 * schema-visualizer.js reads). SQLite has no schema namespacing and no native timestamp
 * type, so `schema "proof" {}` becomes a flat set of tables and `timestamptz` becomes TEXT
 * (ISO 8601, default via SQLite's own datetime('now')). Every statement is idempotent
 * (CREATE ... IF NOT EXISTS) — never DROP — so the database persists across runs.
 */
export const PROOF_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS category (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  "order"    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES category(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  name        TEXT NOT NULL,
  "order"     INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_category_id ON user(category_id);

CREATE TABLE IF NOT EXISTS journey (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  cadence    TEXT NOT NULL CHECK (cadence IN ('one_time', 'repeating')),
  "order"    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_journey_user_id ON journey(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_journey_user_id_slug ON journey(user_id, slug);

CREATE TABLE IF NOT EXISTS phase (
  id         TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journey(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  name       TEXT NOT NULL,
  "order"    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_phase_journey_id ON phase(journey_id);

CREATE TABLE IF NOT EXISTS milestone (
  id         TEXT PRIMARY KEY,
  phase_id   TEXT NOT NULL REFERENCES phase(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  name       TEXT NOT NULL,
  "order"    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_milestone_phase_id ON milestone(phase_id);

CREATE TABLE IF NOT EXISTS goal (
  id           TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES milestone(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  statement    TEXT NOT NULL,
  "order"      INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT,
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_goal_milestone_id ON goal(milestone_id);

CREATE TABLE IF NOT EXISTS step (
  id           TEXT PRIMARY KEY,
  goal_id      TEXT NOT NULL REFERENCES goal(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  trigger      TEXT NOT NULL,
  action       TEXT NOT NULL,
  outcome      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'built' CHECK (status IN ('built', 'partially_built', 'proposed')),
  "order"      INTEGER NOT NULL,
  -- Which sponsor's technology does the work in this step. Replaces the proof tool's own
  -- performed_by (automated / staff-in-app / staff-outside-app): who presses the button
  -- is not what this board is tracking any more, which stack is being exercised is.
  sponsor      TEXT CHECK (sponsor IS NULL OR sponsor IN ('hedera-ats', 'hedera', 'privy', 'ensv2')),
  -- Why this technology is the right tool for THIS job -- the answer to "why not just a
  -- row in your own database". Naming the stack is not a justification; this column is.
  why_stack    TEXT NOT NULL,
  -- The stated qualification requirement this step clears, quoted close to the track's
  -- own wording so a reader can match it against the brief without interpretation.
  requirement  TEXT NOT NULL,
  -- The listed "extra points" item this step hits, when it hits one. Null is the honest
  -- value for a step that only clears a mandatory bar.
  extra_points TEXT,
  -- Why this beats a minimum submission -- the demo moment, or the thing most teams
  -- will not have. This is the column that is actually about winning rather than passing.
  why_wins     TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT,
  deleted_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_step_goal_id ON step(goal_id);

CREATE TABLE IF NOT EXISTS concern (
  id         TEXT PRIMARY KEY,
  step_id    TEXT NOT NULL REFERENCES step(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  thought    TEXT,
  pain_point TEXT,
  opportunity TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_concern_step_id ON concern(step_id);

CREATE TABLE IF NOT EXISTS capability (
  id                   TEXT PRIMARY KEY,
  goal_id              TEXT REFERENCES goal(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  name                 TEXT NOT NULL,
  pattern_name         TEXT,
  activity_patterns    TEXT,
  logic_chains         TEXT,
  claimed_pattern_id   TEXT,
  diagram              TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT,
  deleted_at           TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_goal_id ON capability(goal_id) WHERE goal_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS test_result (
  id              TEXT PRIMARY KEY,
  step_id         TEXT NOT NULL REFERENCES step(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  status          TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  test_file_path  TEXT NOT NULL,
  test_line       INTEGER,
  ran_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_result_step_id ON test_result(step_id);

CREATE TABLE IF NOT EXISTS node (
  id            TEXT PRIMARY KEY,
  capability_id TEXT NOT NULL REFERENCES capability(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  layer         TEXT NOT NULL CHECK (layer IN ('fe', 'bff', 'webhook', 'temporal-workflow', 'temporal-child', 'temporal', 'wait', 'domain', 'domain-service', 'repository', 'integration-adapter', 'external-api', 'db', 'smart_contract')),
  kind          TEXT,
  label         TEXT NOT NULL,
  sublabel      TEXT,
  path          TEXT,
  method        TEXT,
  status        TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'inferred')),
  "order"       INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT,
  deleted_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_node_capability_id ON node(capability_id);

CREATE TABLE IF NOT EXISTS edge (
  id             TEXT PRIMARY KEY,
  source_node_id TEXT NOT NULL REFERENCES node(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  target_node_id TEXT NOT NULL REFERENCES node(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  deleted_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_edge_source_node_id ON edge(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edge_target_node_id ON edge(target_node_id);
`;
