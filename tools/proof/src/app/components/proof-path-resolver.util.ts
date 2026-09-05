/**
 * The one narrow slice of `/journey.json` this file's own path-walking logic actually
 * needs — its own, smaller shape (not the fuller journey tree App.tsx's sibling
 * components read) so this file stays a plain, UI-free module: no React or
 * `react-router-dom` import anywhere in its own chain, mirroring
 * `sidebar-status-rollup.util.ts`'s own pattern.
 */
export interface ProofPathJourneyTreeData {
  journeys: Array<{ id: string; userId: string; slug: string }>;
  phases: Array<{ id: string; journeyId: string; slug: string }>;
  milestones: Array<{ id: string; phaseId: string; slug: string }>;
  goals: Array<{ id: string; milestoneId: string; slug: string }>;
}

export interface ResolvedProofPath {
  journey?: ProofPathJourneyTreeData['journeys'][number];
  phase?: ProofPathJourneyTreeData['phases'][number];
  milestone?: ProofPathJourneyTreeData['milestones'][number];
  goal?: ProofPathJourneyTreeData['goals'][number];
}

export interface ResolveProofPathInput {
  /** The actor named in the URL's own `:user` segment -- every journey slug is scoped to
   *  this actor, since two different actors can each name a journey with the same slug. */
  userId: string;
  /** The slug segments after `:user`, in order: journey, phase, milestone, goal. */
  segments: readonly string[];
  journey: ProofPathJourneyTreeData;
}

/**
 * Walks a slug-segment path against journey data one level at a time -- journey, then
 * phase, then milestone, then goal -- stopping at the first segment that doesn't match a
 * real row scoped to its already-matched parent. Never throws: a path that runs out or
 * goes stale just resolves as deep as it got, which is what a partial or broken link
 * should do rather than crash the page.
 */
export function resolveProofPath({ userId, segments, journey }: ResolveProofPathInput): ResolvedProofPath {
  const result: ResolvedProofPath = {};

  const journeySlug = segments[0];
  const matchedJourney = journeySlug
    ? journey.journeys.find((oneJourney) => oneJourney.userId === userId && oneJourney.slug === journeySlug)
    : undefined;
  if (!matchedJourney) return result;
  result.journey = matchedJourney;

  const phaseSlug = segments[1];
  const matchedPhase = phaseSlug
    ? journey.phases.find((phase) => phase.journeyId === matchedJourney.id && phase.slug === phaseSlug)
    : undefined;
  if (!matchedPhase) return result;
  result.phase = matchedPhase;

  const milestoneSlug = segments[2];
  const matchedMilestone = milestoneSlug
    ? journey.milestones.find((milestone) => milestone.phaseId === matchedPhase.id && milestone.slug === milestoneSlug)
    : undefined;
  if (!matchedMilestone) return result;
  result.milestone = matchedMilestone;

  const goalSlug = segments[3];
  const matchedGoal = goalSlug
    ? journey.goals.find((goal) => goal.milestoneId === matchedMilestone.id && goal.slug === goalSlug)
    : undefined;
  if (!matchedGoal) return result;
  result.goal = matchedGoal;

  return result;
}
