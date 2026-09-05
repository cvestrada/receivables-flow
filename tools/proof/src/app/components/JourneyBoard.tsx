import { useEffect, useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { StepStatus, TestResultStatus, Sponsor } from '../../types/journey.type.js';

interface JourneyData {
  journeys: Array<{ id: string; userId: string; name: string; slug: string; cadence: 'one_time' | 'repeating'; order: number }>;
  phases: Array<{ id: string; journeyId: string; name: string; slug: string; order: number }>;
  milestones: Array<{ id: string; phaseId: string; name: string; slug: string; order: number }>;
  goals: Array<{ id: string; milestoneId: string; statement: string; slug: string; order: number }>;
  steps: Array<{
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
  }>;
  concerns: Array<{ id: string; stepId: string; thought: string | null; painPoint: string | null; opportunity: string | null }>;
  capabilities: Array<{ id: string; goalId: string | null; name: string }>;
  nodes: Array<{ id: string; capabilityId: string; layer: string; label: string; path: string | null; order: number }>;
  testResults: Array<{ id: string; stepId: string; status: TestResultStatus; testFilePath: string; testLine: number | null; ranAt: string }>;
}

const LABEL_COL_WIDTH = 150;
const COL_WIDTH = 200;

/** One fixed height per row, shared by the label rail and the content grid — the only
 *  way to guarantee two separately-scrolling grids stay aligned row for row. */
/** The bottom three rows answer "why does this win", not "how did the user feel". The
 *  proof tool's own Touchpoints/Thoughts/Feelings/Pain Points/Opportunities rows are a
 *  UX-research shape; this board is read by someone deciding whether a submission clears
 *  a prize bar, and those five rows had nothing to say to that reader. */
const ROW_LABELS = [
  'Phase',
  'What They Can Do',
  'Steps (How)',
  'Why This Stack',
  'Requirement Met',
  'Extra Points',
  'Why We Win',
] as const;
/** Phase and Milestones are section headers, sized to their own short text. Feelings is
 *  the wave chart, not a text card. Steps (How) stacks one card per step in a goal, each
 *  card carrying its own proof badge inline (see the Steps (How) row below). That row's
 *  own grid track is sized 'max-content', not a fixed px guess -- a card's own height
 *  isn't fixed either (min-h-28, not h-28: real action text can run to several lines,
 *  e.g. capital-cycle's own cross-app visibility steps), so only the browser, after
 *  laying out real text, actually knows how tall the tallest column gets. A fixed-height
 *  card with overflow-y-auto used to silently clip its own badge row off-screen the
 *  moment its action text alone filled the card -- found by the human directly on a real
 *  card that never showed its performedBy badge, not caught by any test, since nothing
 *  here is about correctness of the data, only whether it's visible. The four single-
 *  value per-goal info cards (Goal, Touchpoints, Thoughts, Pain Points, Opportunities)
 *  still share one fixed height, CARD_HEIGHT, since their own content is always short. */
const CARD_HEIGHT = 90;
/** The step card's own Tailwind class below is min-h-28 (112px) with gap-1 (STEP_CARD_GAP,
 *  4px) between cards -- both still real Tailwind values, just no longer a ceiling: a card
 *  can grow taller than STEP_CARD_HEIGHT, and the grid row (sized 'max-content' below)
 *  grows with it. Kept as a named constant only because the Tailwind class must still be
 *  read, at a glance, as "112px" by anyone comparing the two. */
const STEP_CARD_HEIGHT = 112;
const STEP_CARD_GAP = 4;
/** Shared by the label rail and the content grid, same reason as gridTemplateRows —
 *  two separate grids need the identical gap to stay aligned row for row. */
const ROW_GAP = 8;

/** Built gets the plain rose card. Proposed and partially_built both get a dashed
 *  border so an unfinished step never looks indistinguishable from a real one, but in
 *  different colors so "nothing real exists yet" (amber) reads as a different kind of
 *  gap than "real, but doesn't fully meet its outcome yet" (blue). */
const STATUS_BORDER_CLASS: Record<StepStatus, string> = {
  built: 'border border-rose-100',
  partially_built: 'border-2 border-dashed border-blue-300',
  proposed: 'border-2 border-dashed border-amber-300',
};
const STATUS_BADGE: Partial<Record<StepStatus, { label: string; className: string }>> = {
  partially_built: { label: 'Partially Built', className: 'text-blue-600' },
  proposed: { label: 'Proposed', className: 'text-amber-600' },
};
const STATUS_TITLE: Record<StepStatus, string> = {
  built: 'Open the real code behind this step',
  partially_built: "Partially built — the core path is real, but doesn't fully meet its outcome yet",
  proposed: 'Proposed — not yet backed by real code',
};
/** Same border treatment as STATUS_BORDER_CLASS, spelled out in full per status so
 *  Tailwind's static class scanner can see every class literally, instead of building
 *  one at runtime. */
const STATUS_BUTTON_BORDER_CLASS: Record<StepStatus, string> = {
  built: 'border border-rose-100',
  partially_built: 'border-2 border-dashed border-blue-300',
  proposed: 'border-2 border-dashed border-amber-300',
};

/** A goal's own status reads as its worst step -- any proposed step is a real, unbuilt
 *  gap in that goal even if its other steps are already built, and that gap should never
 *  be hidden behind a goal-level badge that only reflects one, better-looking step.
 *  Returns the step itself, not just its status, so the Goal (What) card can navigate to
 *  the exact step the badge is reporting on -- clicking through must land on the same
 *  gap the badge just warned about, never on some other, better-looking step. */
/** Exported so ProofSidebar.tsx's own row rollup (TECH-448, Flow 4) reuses this exact
 *  ordering instead of keeping a second, potentially-drifting copy of it. */
export const STATUS_SEVERITY: Record<StepStatus, number> = { proposed: 2, partially_built: 1, built: 0 };
function worstStep(steps: JourneyData['steps']): JourneyData['steps'][number] | undefined {
  return steps.reduce<JourneyData['steps'][number] | undefined>(
    (worst, step) => (!worst || STATUS_SEVERITY[step.status] > STATUS_SEVERITY[worst.status] ? step : worst),
    undefined,
  );
}

/** A real test's own pass/fail result against a step -- this is the "Proof" row's own
 *  content, always independent of that step's own hand-typed status column above (see
 *  TestResultTable's own comment in types.ts). "Not yet tested" covers the overwhelming
 *  majority of steps today: only the corrected Sign Up goal has real (illustrative)
 *  test_result rows seeded so far -- wiring live results into every other journey is
 *  separate, later work, taken on one journey at a time. */
const TEST_RESULT_BADGE: Record<TestResultStatus, { label: string; className: string }> = {
  passed: { label: 'Passed', className: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  failed: { label: 'Failed', className: 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' },
};
const NOT_TESTED_CLASS = 'text-gray-400 bg-gray-50 border-gray-200';

/** Whose technology does the work in this step -- a first-class, scannable mark, so that
 *  reading down the Steps column tells you which stack each sponsor is actually carrying.
 *  Replaces the proof tool's own performed-by badge: who presses the button is not what
 *  this board tracks. 'hedera' is Hedera-native work outside ATS (scheduled transactions,
 *  settlement), kept distinct so the ATS count is not quietly inflated by it. */
const SPONSOR_BADGE: Record<Sponsor, { label: string; className: string }> = {
  'hedera-ats': { label: 'Hedera ATS', className: 'text-purple-700 bg-purple-50 border-purple-200' },
  hedera: { label: 'Hedera', className: 'text-violet-600 bg-violet-50 border-violet-200' },
  privy: { label: 'Privy', className: 'text-sky-700 bg-sky-50 border-sky-200' },
  ensv2: { label: 'ENSv2', className: 'text-teal-700 bg-teal-50 border-teal-200' },
};

/** VS Code's own registered URI scheme -- clicking this opens the real test file (and,
 *  when known, the exact line the test starts on) directly in the reader's editor. Only
 *  works when VS Code is installed and its URI handler is registered, same tradeoff every
 *  "open in editor" link makes; this is a local dev tool, not a hosted one. */
function vscodeFileUrl({ path, line }: { path: string; line: number | null }): string {
  return line ? `vscode://file/${path}:${line}` : `vscode://file/${path}`;
}

interface JourneyBoardProps {
  actorId?: string;
  /** The journey slug the URL's own path resolver already matched, if any -- undefined
   *  means "no journey chosen yet" (the bare /proof/:actor root). */
  journeySlug?: string;
  /** The deepest phase or milestone id the URL's own path resolver already matched --
   *  scrolled into view once the board has real content to scroll to. */
  scrollTargetId?: string;
}

/**
 * A real user journey map board, three separate regions: a header that never scrolls,
 * a label rail that never scrolls horizontally, and the phase/milestone/goal content,
 * which scrolls horizontally on its own. Three genuinely separate elements, not one
 * scrolling grid with a sticky column pretending to be pinned — that approach let
 * partially-scrolled cells bleed through at the boundary.
 */
export default function JourneyBoard({ actorId, journeySlug, scrollTargetId }: JourneyBoardProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which step's footer (real code + real test, both) is open right now -- one at a
   *  time, closed by its own × button or by picking a different step. */
  const [openStepId, setOpenStepId] = useState<string | null>(null);

  /** A phase or milestone selected in the sidebar (or named directly in the URL) scrolls
   *  into view once the board has real content to scroll to. */
  useEffect(() => {
    if (!data || !scrollTargetId) return;
    const target = document.getElementById(scrollTargetId);
    target?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [data, scrollTargetId]);

  useEffect(() => {
    fetch('/journey.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load journey.json: ${r.status}`);
        return r.json() as Promise<JourneyData>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const actorJourneys = useMemo(
    () => (data && actorId ? data.journeys.filter((j) => j.userId === actorId).sort((a, b) => a.order - b.order) : []),
    [data, actorId],
  );
  const journey = journeySlug ? actorJourneys.find((j) => j.slug === journeySlug) : undefined;

  const board = useMemo(() => {
    if (!data || !journey) return null;

    const phases = data.phases.filter((p) => p.journeyId === journey.id).sort((a, b) => a.order - b.order);
    const stepsByGoalId = new Map<string, JourneyData['steps']>();
    for (const step of data.steps) {
      const list = stepsByGoalId.get(step.goalId) ?? [];
      list.push(step);
      stepsByGoalId.set(step.goalId, list);
    }
    for (const list of stepsByGoalId.values()) list.sort((a, b) => a.order - b.order);

    const concernsByStepId = new Map<string, JourneyData['concerns']>();
    for (const concern of data.concerns) {
      const list = concernsByStepId.get(concern.stepId) ?? [];
      list.push(concern);
      concernsByStepId.set(concern.stepId, list);
    }

    /** Only the corrected Sign Up goal has more than one row today -- every other real
     *  test_result row seeded so far is one-per-step, so "latest" reduces to "the only
     *  one" in practice, but this still picks the most recent by ranAt so it stays
     *  correct once a step accumulates more than one real run. */
    const latestTestResultByStepId = new Map<string, JourneyData['testResults'][number]>();
    for (const result of data.testResults) {
      const existing = latestTestResultByStepId.get(result.stepId);
      if (!existing || result.ranAt > existing.ranAt) latestTestResultByStepId.set(result.stepId, result);
    }

    let columnIndex = 0;
    const phaseCols = phases.map((phase) => {
      const milestones = data.milestones.filter((m) => m.phaseId === phase.id).sort((a, b) => a.order - b.order);
      const milestoneCols = milestones.map((milestone) => {
        const goals = data.goals.filter((g) => g.milestoneId === milestone.id).sort((a, b) => a.order - b.order);
        const goalCols = goals.map((goal) => {
          const steps = stepsByGoalId.get(goal.id) ?? [];
          const concerns = steps.flatMap((step) => concernsByStepId.get(step.id) ?? []);
          /** The last step by order stands in for the whole goal in the single-value rows
           *  below (Touchpoints, Feelings) -- it's the step that actually reaches the
           *  goal's own stated outcome, same step the goal's own capability (if any) is
           *  linked to. */
          const lastStep = steps.at(-1);
          const col = columnIndex;
          columnIndex += 1;
          return {
            goal,
            steps,
            concerns,
            /** A goal's steps can each clear a different bar, so these three rows join
             *  every distinct value under the goal rather than showing only the last
             *  step's -- collapsing them would silently drop a requirement a goal really
             *  does cover. */
            whyStack: [...new Set(steps.map((step) => step.whyStack).filter(Boolean))],
            requirements: [...new Set(steps.map((step) => step.requirement).filter(Boolean))],
            extraPoints: [...new Set(steps.map((step) => step.extraPoints).filter((v): v is string => Boolean(v)))],
            whyWins: [...new Set(steps.map((step) => step.whyWins).filter(Boolean))],
            status: worstStep(steps)?.status ?? 'proposed',
            col,
            /** The goal's own ancestor slugs, carried alongside it so a click on this
             *  goal's card can build its full nested slug path without a separate lookup. */
            phaseSlug: phase.slug,
            milestoneSlug: milestone.slug,
          };
        });
        /** A milestone with no goals still needs to reserve a real column -- a CSS grid span
         *  of 0 is invalid per spec (the browser falls back to auto-placement instead), and
         *  reusing the next milestone's column for colStart would overlap two headers on top
         *  of each other. Reserving an empty column here just renders as blank content below
         *  it, which is the honest picture: this milestone genuinely has nothing under it yet. */
        const colStart = goalCols[0]?.col ?? columnIndex;
        if (goalCols.length === 0) columnIndex += 1;
        return { milestone, goalCols, colStart, span: Math.max(1, goalCols.length) };
      });
      /** Same reservation as above, one level up: a phase with no milestones at all still
       *  needs its own real column so it doesn't collide with whichever phase comes next. */
      const phaseColStart = milestoneCols[0]?.colStart ?? columnIndex;
      if (milestoneCols.length === 0) columnIndex += 1;
      return { phase, milestoneCols, colStart: phaseColStart, span: Math.max(1, milestoneCols.reduce((sum, m) => sum + m.span, 0)) };
    });

    const allGoalCols = phaseCols.flatMap((p) => p.milestoneCols.flatMap((m) => m.goalCols));
    return { phaseCols, allGoalCols, totalColumns: columnIndex, latestTestResultByStepId };
  }, [data, journey]);

  if (error) {
    return (
      <div className="p-6 text-red-600 text-sm">
        <p className="font-medium">Could not load journey data</p>
        <p className="mt-1 text-gray-500">{error}</p>
        <p className="mt-2 text-gray-400">
          Run <code className="bg-gray-100 px-1 rounded">pnpm --filter @orbbit/proof run seed:business</code> first.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  }

  /** No journey chosen yet (landed on the bare /proof/:user) — go to the actor's first
   *  journey rather than showing a blank board. */
  if (!journeySlug && actorJourneys.length > 0) {
    return <Navigate to={`/proof/${actorId}/${actorJourneys[0]!.slug}`} replace />;
  }

  if (journeySlug && !journey) {
    return <div className="p-6 text-gray-400 text-sm">No journey found for "{journeySlug}".</div>;
  }

  if (!board) {
    return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  }

  /** board always exists once data loads (its useMemo returns an empty-but-valid shape for
   *  an actor with zero phases) -- but repeat(0, ...) is invalid CSS grid syntax, so a
   *  zero-phase actor (reachable by a direct link to /proof/<user> even for an actor with
   *  no seeded journey yet) needs its own message instead of rendering a broken grid. */
  if (board.totalColumns === 0) {
    return <div className="p-6 text-gray-400 text-sm">No journey seeded for "{actorId}" yet.</div>;
  }

  /** 'max-content' rather than a computed px number -- the real height of the tallest
   *  column depends on both how many steps it has AND how many lines each one's own real
   *  action text wraps to, and only the browser knows the second part once real text is
   *  laid out. A goal with only one or two short steps just leaves blank space below its
   *  cards, same as a short Goal/Touchpoints card does today. */
  const ROW_HEIGHTS: (number | 'max-content')[] = [48, CARD_HEIGHT, 'max-content', 'max-content', 'max-content', 'max-content', 'max-content'];
  const gridTemplateRows = ROW_HEIGHTS.map((h) => (typeof h === 'number' ? `${h}px` : h)).join(' ');

  /** The label rail is column 1 of the SAME grid as the content, not a grid of its own.
   *  Two separate grids sharing a gridTemplateRows string still disagree: 'max-content'
   *  is resolved per grid, so the rail sized itself to its own short label text while the
   *  content row sized itself to the tallest stack of cards, and every row below Steps
   *  drifted further out of line. One grid, with the label column pinned by position:
   *  sticky, makes them the same rows by construction rather than by coincidence. */
  const gridTemplateColumns = `${LABEL_COL_WIDTH}px repeat(${board.totalColumns}, ${COL_WIDTH}px)`;
  const openStep = openStepId ? data.steps.find((s) => s.id === openStepId) : undefined;
  const openCapability = openStep ? data.capabilities.find((c) => c.goalId === openStep.goalId) : undefined;
  const openCodeNode = openCapability
    ? data.nodes.filter((n) => n.capabilityId === openCapability.id).sort((a, b) => a.order - b.order)[0]
    : undefined;
  const openTestResult = openStep ? board.latestTestResultByStepId.get(openStep.id) : undefined;

  return (
    <div className="relative h-full flex flex-col bg-white">
      {/* 1. Header — never scrolls */}
      <div className="border-b border-gray-200 px-6 py-3 shrink-0 flex items-center gap-2">
        <h1 className="font-mono text-sm text-gray-400">
          User Journey Map — {actorId} / {journey!.name}
        </h1>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            journey!.cadence === 'repeating' ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {journey!.cadence === 'repeating' ? '🔁 Repeats' : 'One-time'}
        </span>
      </div>

      {/* 2. Board — one grid, scrolling both ways. The label column is pinned with
          position: sticky so it stays put while the goal columns scroll under it. */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid gap-x-2 pr-8 py-2" style={{ gridTemplateColumns, gridTemplateRows, rowGap: ROW_GAP, width: LABEL_COL_WIDTH + board.totalColumns * COL_WIDTH + 32 }}>
          {/* Row labels — column 1, pinned */}
          {ROW_LABELS.map((label, i) => (
            <div
              key={label}
              className={`sticky left-0 z-10 bg-white border-r border-gray-200 flex items-start px-3 pt-3 text-xs ${
                i === 0 ? 'font-semibold text-gray-600' : 'font-medium text-gray-500'
              }`}
              style={{ gridColumn: 1, gridRow: i + 1 }}
            >
              {label}
            </div>
          ))}

            {/* Phase header row */}
            {board.phaseCols.map((p) => (
              <div
                key={p.phase.id}
                id={p.phase.id}
                className="self-center bg-indigo-50 border border-indigo-200 rounded-md text-center font-semibold text-sm py-2 scroll-mt-6"
                style={{ gridColumn: `${p.colStart + 2} / span ${p.span}`, gridRow: 1 }}
              >
                {p.phase.name}
              </div>
            ))}

            {/* Goal (What) — dashed border + badge flags a proposed or partially_built step,
                same treatment the capability drill-in already uses for inferred nodes. When a
                goal has several steps, this reads as the worst of them, never the best.
                Clicking it opens the full diagram page for that same worst step -- never a
                better-looking step -- so the page it lands on always explains the gap the
                badge just warned about, not a different, more finished one. */}
            {board.allGoalCols.map((c) => {
              const target = worstStep(c.steps);
              const goalPath = `/proof/${actorId}/${journey!.slug}/${c.phaseSlug}/${c.milestoneSlug}/${c.goal.slug}`;
              return (
                <div
                  key={c.goal.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => target && navigate(goalPath)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    if (target) navigate(goalPath);
                  }}
                  className={`self-stretch flex flex-col items-start bg-rose-50/60 rounded-md text-xs px-2 py-2 leading-snug overflow-y-auto cursor-pointer hover:bg-indigo-50 transition-colors ${
                    STATUS_BORDER_CLASS[c.status]
                  }`}
                  style={{ gridColumn: c.col + 2, gridRow: 2 }}
                  title="Open the real code diagram behind this goal"
                >
                  {STATUS_BADGE[c.status] && (
                    <span className={`text-[9px] font-semibold uppercase tracking-wide mb-0.5 ${STATUS_BADGE[c.status]!.className}`}>
                      {STATUS_BADGE[c.status]!.label}
                    </span>
                  )}
                  {c.goal.statement}
                </div>
              );
            })}

            {/* Steps (How) — an ordered stack of step cards, one per real step this goal
                takes, instead of the single hand-typed claim this row used to force. Each
                card is plain "N. text" -- no special number UI -- and carries its own proof
                badge, a plain status label, never a click target of its own. The whole card
                is the one click target: it opens the footer below with both the real code
                behind this step and the real test that proves it, side by side. */}
            {board.allGoalCols.map((c) => (
              <div key={c.goal.id} className="self-stretch flex flex-col gap-1 overflow-y-auto" style={{ gridColumn: c.col + 2, gridRow: 3 }}>
                {c.steps.length === 0 && <span className="text-gray-300 text-xs px-2">—</span>}
                {c.steps.map((step) => {
                  const result = board.latestTestResultByStepId.get(step.id);
                  const badge = result ? TEST_RESULT_BADGE[result.status] : undefined;
                  return (
                    <div
                      key={step.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenStepId(step.id)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        setOpenStepId(step.id);
                      }}
                      className={`shrink-0 min-h-28 flex flex-col gap-1 bg-rose-50/60 rounded-md text-xs px-2 py-1.5 leading-snug text-left cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors ${
                        STATUS_BUTTON_BORDER_CLASS[step.status]
                      }`}
                      title={STATUS_TITLE[step.status]}
                    >
                      <div>
                        {step.order}. {step.action}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className={`self-start shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border ${badge ? badge.className : NOT_TESTED_CLASS}`}>
                          {badge ? badge.label : 'Not yet tested'}
                        </span>
                        {step.sponsor && (
                          <span className={`self-start shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border ${SPONSOR_BADGE[step.sponsor].className}`}>
                            {SPONSOR_BADGE[step.sponsor].label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Why This Stack — why this technology is right for this job, not just which
                technology it is. The answer to "why not a row in your own database". */}
            {board.allGoalCols.map((c) => (
              <div
                key={c.goal.id}
                className="self-stretch flex flex-col gap-1 bg-slate-50 border border-slate-200 rounded-md text-xs px-2 py-2 leading-snug text-slate-700"
                style={{ gridColumn: c.col + 2, gridRow: 4 }}
              >
                {c.whyStack.length > 0 ? (
                  <ol className="list-decimal list-outside pl-4 space-y-1">
                    {c.whyStack.map((w) => <li key={w}>{w}</li>)}
                  </ol>
                ) : <span className="text-slate-400">—</span>}
              </div>
            ))}

            {/* Requirement Met — the stated qualification bar this goal's steps clear */}
            {board.allGoalCols.map((c) => (
              <div
                key={c.goal.id}
                className={`self-stretch flex flex-col gap-1 bg-rose-50/60 rounded-md text-xs px-2 py-2 leading-snug text-gray-700 ${
                  STATUS_BORDER_CLASS[c.status]
                }`}
                style={{ gridColumn: c.col + 2, gridRow: 5 }}
              >
                {c.requirements.length > 0 ? (
                  <ol className="list-decimal list-outside pl-4 space-y-1">
                    {c.requirements.map((r) => <li key={r}>{r}</li>)}
                  </ol>
                ) : <span className="text-gray-400">—</span>}
              </div>
            ))}

            {/* Extra Points — only where a listed bonus item is genuinely hit. An em-dash
                here is a real answer: this step clears a mandatory bar and nothing more. */}
            {board.allGoalCols.map((c) => (
              <div
                key={c.goal.id}
                className="self-stretch flex flex-col gap-1 bg-emerald-50/70 border border-emerald-200 rounded-md text-xs px-2 py-2 leading-snug text-emerald-900"
                style={{ gridColumn: c.col + 2, gridRow: 6 }}
              >
                {c.extraPoints.length > 0 ? (
                  <ol className="list-decimal list-outside pl-4 space-y-1">
                    {c.extraPoints.map((e) => <li key={e}>{e}</li>)}
                  </ol>
                ) : <span className="text-emerald-700/40">—</span>}
              </div>
            ))}

            {/* Why We Win — the demo moment, or the thing most teams will not have */}
            {board.allGoalCols.map((c) => (
              <div
                key={c.goal.id}
                className="self-stretch flex flex-col gap-1 bg-amber-50/70 border border-amber-200 rounded-md text-xs px-2 py-2 leading-snug text-amber-950"
                style={{ gridColumn: c.col + 2, gridRow: 7 }}
              >
                {c.whyWins.length > 0 ? (
                  <ol className="list-decimal list-outside pl-4 space-y-1">
                    {c.whyWins.map((w) => <li key={w}>{w}</li>)}
                  </ol>
                ) : <span className="text-amber-700/40">—</span>}
              </div>
            ))}
          </div>
      </div>

      {/* Step footer — opened by clicking any Steps (How) card. Shows both real things
          that back a step, side by side: the real code (its goal's own capability, same
          diagram the Goal (What) card opens in full) and the real test that proves it
          (independent of the step's own hand-typed status above it). Only each path
          itself is a click target, same as the capability drill-in's own detail panel --
          never the whole footer. */}
      {openStep && (
        <div className="absolute bottom-0 left-0 right-0 bg-white/96 backdrop-blur-sm border-t border-gray-200 shadow-xl px-4 py-3 z-50 flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {openCodeNode?.layer ?? 'Code'}
            </span>
            {openCodeNode ? (
              <>
                <p className="text-sm font-semibold text-gray-900 mt-1">{openCodeNode.label}</p>
                {openCodeNode.path ? (
                  <a
                    href={vscodeFileUrl({ path: openCodeNode.path, line: null })}
                    className="mt-1 block text-[11px] font-mono text-blue-600 hover:text-blue-800 break-all leading-relaxed"
                  >
                    {openCodeNode.path}
                  </a>
                ) : (
                  <p className="mt-1 text-[11px] text-gray-400 italic">No file path</p>
                )}
              </>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400 italic">No real code resolved for this step yet</p>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Test</span>
            {openTestResult ? (
              <>
                <p className={`text-sm font-semibold mt-1 ${TEST_RESULT_BADGE[openTestResult.status].className.split(' ')[0]}`}>
                  {TEST_RESULT_BADGE[openTestResult.status].label}
                </p>
                <a
                  href={vscodeFileUrl({ path: openTestResult.testFilePath, line: openTestResult.testLine })}
                  className="mt-1 block text-[11px] font-mono text-blue-600 hover:text-blue-800 break-all leading-relaxed"
                >
                  {openTestResult.testFilePath}
                  {openTestResult.testLine ? `:${openTestResult.testLine}` : ''}
                </a>
              </>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400 italic">Not yet tested</p>
            )}
          </div>
          <button className="text-gray-400 hover:text-gray-700 shrink-0 text-lg leading-none" onClick={() => setOpenStepId(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
