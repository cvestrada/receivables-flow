import { STATUS_SEVERITY } from './JourneyBoard.js';
import type { StepStatus } from '../../types/journey.type.js';

/**
 * The one narrow slice of `/journey.json` ProofSidebar.tsx's own row rollup actually
 * needs — deliberately its own, smaller shape (not the fuller `JourneyTreeData` the
 * sidebar component itself reads) so this file stays a plain, UI-free module: no
 * `@orbbit/fe-platform-ui` (Vite-only alias, unresolved under plain Node/vitest) or React
 * import anywhere in its own chain, only `STATUS_SEVERITY` from `JourneyBoard.tsx` (a
 * plain exported constant, real npm deps only) and the shared `StepStatus` type.
 */
export interface SidebarJourneyTreeData {
  journeys: Array<{ id: string; userId: string }>;
  phases: Array<{ id: string; journeyId: string }>;
  milestones: Array<{ id: string; phaseId: string }>;
  goals: Array<{ id: string; milestoneId: string }>;
  steps: Array<{ id: string; goalId: string; status: StepStatus }>;
}

export interface SidebarStatusRollup {
  goalStatusById: Map<string, StepStatus>;
  milestoneStatusById: Map<string, StepStatus>;
  phaseStatusById: Map<string, StepStatus>;
  journeyStatusById: Map<string, StepStatus>;
  actorStatusById: Map<string, StepStatus>;
}

/** Picks the worst (highest-severity) status out of a row's own children, reusing
 *  JourneyBoard.tsx's exact STATUS_SEVERITY order rather than a second, potentially-
 *  drifting copy of it. `defaultStatus` is what a row with zero children rolls up to —
 *  'proposed' at the goal level (matching JourneyBoard.tsx's own
 *  `worstStep(steps)?.status ?? 'proposed'`, since a goal with no steps at all genuinely
 *  has nothing real behind it yet), 'built' at every level above (an empty milestone/
 *  phase/journey/actor is a genuinely empty container, not a known gap, so it shows no
 *  badge — silence stays the signal for "nothing to check here"). */
function worstOf(statuses: StepStatus[], defaultStatus: StepStatus): StepStatus {
  /** defaultStatus only ever applies to a genuinely empty list -- it must never be used as
   *  the reduce's own seed value, since 'proposed' (the goal-level default) is the HIGHEST
   *  severity: seeding the reduce with it would make every real, less-severe status look
   *  smaller by comparison and silently never win. */
  if (statuses.length === 0) return defaultStatus;
  return statuses.reduce((worst, status) => (STATUS_SEVERITY[status] > STATUS_SEVERITY[worst] ? status : worst));
}

/**
 * Rolls a whole journey tree up to a per-row worst-status map, one level at a time —
 * goal -> milestone -> phase -> journey -> actor (TECH-448, Flow 4) — the same rollup
 * `JourneyBoard.tsx`'s own `worstStep` already does for a goal, extended one level
 * further each time. Every id present in the input tree gets an entry in its own map,
 * even a childless one, so a caller never has to guess whether a missing map entry means
 * "built" or "not computed yet".
 */
export function rollUpSidebarStatuses(journey: SidebarJourneyTreeData, actors: readonly string[]): SidebarStatusRollup {
  const goalStatusById = new Map<string, StepStatus>();
  for (const goal of journey.goals) {
    const statuses = journey.steps.filter((step) => step.goalId === goal.id).map((step) => step.status);
    goalStatusById.set(goal.id, worstOf(statuses, 'proposed'));
  }

  const milestoneStatusById = new Map<string, StepStatus>();
  for (const milestone of journey.milestones) {
    const statuses = journey.goals.filter((goal) => goal.milestoneId === milestone.id).map((goal) => goalStatusById.get(goal.id)!);
    milestoneStatusById.set(milestone.id, worstOf(statuses, 'built'));
  }

  const phaseStatusById = new Map<string, StepStatus>();
  for (const phase of journey.phases) {
    const statuses = journey.milestones.filter((milestone) => milestone.phaseId === phase.id).map((milestone) => milestoneStatusById.get(milestone.id)!);
    phaseStatusById.set(phase.id, worstOf(statuses, 'built'));
  }

  const journeyStatusById = new Map<string, StepStatus>();
  for (const oneJourney of journey.journeys) {
    const statuses = journey.phases.filter((phase) => phase.journeyId === oneJourney.id).map((phase) => phaseStatusById.get(phase.id)!);
    journeyStatusById.set(oneJourney.id, worstOf(statuses, 'built'));
  }

  const actorStatusById = new Map<string, StepStatus>();
  for (const actor of actors) {
    const statuses = journey.journeys.filter((oneJourney) => oneJourney.userId === actor).map((oneJourney) => journeyStatusById.get(oneJourney.id)!);
    actorStatusById.set(actor, worstOf(statuses, 'built'));
  }

  return { goalStatusById, milestoneStatusById, phaseStatusById, journeyStatusById, actorStatusById };
}

/** Same amber/blue palette JourneyBoard.tsx's own STATUS_BORDER_CLASS/STATUS_BADGE
 *  already use for "proposed"/"partially_built" — a filled dot instead of a border+label
 *  combo, since the sidebar's own rows are too narrow and deeply nested for a full card
 *  treatment. No entry for 'built': a fully-built row shows no badge at all, matching
 *  JourneyBoard.tsx's own "silence means done" convention. */
const STATUS_DOT_CLASS: Partial<Record<StepStatus, string>> = {
  proposed: 'bg-amber-400',
  partially_built: 'bg-blue-400',
};

export function resolveSidebarBadgeClassName(status: StepStatus): string | undefined {
  return STATUS_DOT_CLASS[status];
}
