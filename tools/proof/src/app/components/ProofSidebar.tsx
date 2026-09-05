import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, PanelLeft, Briefcase, TrendingUp, Landmark, Package, Megaphone, CircleCheck, Flag, Milestone, Route, Repeat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from '../../ui/index.js';
import type { StepStatus } from '../../types/journey.type.js';
import { rollUpSidebarStatuses, resolveSidebarBadgeClassName } from './sidebar-status-rollup.util.js';
import { groupActorsByCategory } from './category-group.util.js';

interface JourneyCategory { id: string; name: string; order: number }
interface JourneyUser { id: string; name: string; categoryId: string; order: number }
interface JourneyJourney { id: string; userId: string; name: string; slug: string; cadence: 'one_time' | 'repeating'; order: number }
interface JourneyPhase { id: string; journeyId: string; name: string; slug: string; order: number }
interface JourneyMilestone { id: string; phaseId: string; name: string; slug: string; order: number }
interface JourneyGoal { id: string; milestoneId: string; statement: string; slug: string; order: number }
interface JourneyStep { id: string; goalId: string; order: number; status: StepStatus }
interface JourneyCapabilityRef { id: string; claimedPatternId: string | null }
interface JourneyTreeData {
  categories: JourneyCategory[];
  users: JourneyUser[];
  journeys: JourneyJourney[];
  phases: JourneyPhase[];
  milestones: JourneyMilestone[];
  goals: JourneyGoal[];
  steps: JourneyStep[];
  capabilities: JourneyCapabilityRef[];
}

/** A row's rolled-up status (TECH-448, Flow 4) — a small filled dot, not a full-width
 *  card border like JourneyBoard.tsx uses, since the sidebar's own rows are narrow and
 *  deeply nested. No badge at all for 'built' (resolveSidebarBadgeClassName returns
 *  undefined): silence stays the signal for "nothing left to check here", same
 *  convention JourneyBoard.tsx's own STATUS_BADGE already follows. */
function SidebarStatusBadge({ status }: { status: StepStatus | undefined }) {
  const className = status ? resolveSidebarBadgeClassName(status) : undefined;
  if (!className) return null;
  return (
    <span
      className={`ml-1 inline-block size-1.5 shrink-0 self-center rounded-full ${className}`}
      title={status === 'proposed' ? 'Proposed somewhere in here — not yet backed by real code' : 'Partially built somewhere in here — the real code exists but doesn\'t fully meet its outcome yet'}
    />
  );
}

/** Display name and icon per actor — presentation only, so these stay hand-maintained
 *  here rather than sourced from the actor's own (lowercase, id-shaped) `name` column.
 *  Every real actor an operator can drill into; grouping under a category is decided by
 *  `groupActorsByCategory`, not by this list. */
const ACTOR_LABEL: Record<string, string> = {
  'capital-flywheel': 'Capital Flywheel',
  business: 'Business',
  investor: 'Investor',
  hq: 'HQ',
  'market-intelligence': 'Market Intelligence',
  'social-media': 'Social Media',
};

/** Plain lucide icons, never emoji. Social Media gets its own icon, distinct from Fintech's
 *  Business/Investor — it's Orbbit's own operation, not an audience passing through. */
const ACTOR_ICON: Record<string, LucideIcon> = {
  'capital-flywheel': Repeat,
  business: Briefcase,
  investor: TrendingUp,
  hq: Landmark,
  'market-intelligence': Package,
  'social-media': Megaphone,
};

/** Every real actor — each expands into its real phase -> milestone -> goal tree, a goal
 *  leaf opening that action's real code chain. */
export const JOURNEY_BOARD_ACTORS: ReadonlySet<string> = new Set<string>([
  'capital-flywheel',
  'business',
  'hq',
  'investor',
  'market-intelligence',
  'social-media',
]);

function BranchIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <ChevronRight
      className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
    />
  );
}

interface ProofSidebarProps {
  /** Set when the current page is a journey-board or drill-in view. */
  activeJourneyUser?: string;
  /** The deepest journey/phase/milestone/goal ids the URL's own slug path resolved to,
   *  computed once by App.tsx's own path resolver -- undefined at any level the URL
   *  didn't name or that didn't match a real row. */
  resolvedJourneyId?: string;
  resolvedPhaseId?: string;
  resolvedMilestoneId?: string;
  resolvedGoalId?: string;
}

/**
 * The whole navigation surface: one category group per Linear initiative (Fintech, Market
 * Intelligence, Growth), each with its own header, each actor inside expanding into
 * its real phase -> milestone -> goal tree, a goal leaf opening that action's real code
 * chain.
 */
export default function ProofSidebar({
  activeJourneyUser,
  resolvedJourneyId,
  resolvedPhaseId,
  resolvedMilestoneId,
  resolvedGoalId,
}: ProofSidebarProps) {
  const navigate = useNavigate();

  const [journey, setJourney] = useState<JourneyTreeData>({ categories: [], users: [], journeys: [], phases: [], milestones: [], goals: [], steps: [], capabilities: [] });
  useEffect(() => {
    fetch('/journey.json')
      .then((r) => (r.ok ? r.json() : journey))
      .then((j: JourneyTreeData) =>
        setJourney({
          categories: j.categories ?? [], users: j.users ?? [], journeys: j.journeys ?? [], phases: j.phases ?? [], milestones: j.milestones ?? [],
          goals: j.goals ?? [], steps: j.steps ?? [], capabilities: j.capabilities ?? [],
        }),
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryGroups = useMemo(() => groupActorsByCategory(journey.categories, journey.users), [journey.categories, journey.users]);
  const actorIds = useMemo(() => journey.users.map((user) => user.id), [journey.users]);

  /** TECH-448 (Flow 4): every row's own rolled-up worst-descendant status, recomputed
   *  whenever fresh journey data arrives — the same rollup JourneyBoard.tsx's own
   *  worstStep already does for a goal, extended one level further each time up through
   *  milestone, phase, journey, and actor. */
  const statusRollup = useMemo(() => rollUpSidebarStatuses(journey, actorIds), [journey, actorIds]);

  const selectedJourney = resolvedJourneyId ? journey.journeys.find((j) => j.id === resolvedJourneyId) : undefined;
  const selectedPhase = resolvedPhaseId ? journey.phases.find((p) => p.id === resolvedPhaseId) : undefined;
  const selectedMilestone = resolvedMilestoneId ? journey.milestones.find((m) => m.id === resolvedMilestoneId) : undefined;
  const selectedGoal = resolvedGoalId ? journey.goals.find((g) => g.id === resolvedGoalId) : undefined;

  const [isCollapsed, setIsCollapsed] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(activeJourneyUser ? [activeJourneyUser] : []),
  );
  const [expandedJourneys, setExpandedJourneys] = useState<Set<string>>(() => new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(() => new Set());

  /** A phase or action selected elsewhere (browser back/forward, a direct link) expands
   *  the path down to it — it never collapses branches the reader already opened. */
  useEffect(() => {
    if (activeJourneyUser && (resolvedJourneyId || resolvedPhaseId || resolvedMilestoneId || resolvedGoalId)) {
      /** Only force the actor group open when there's an actual nested journey/phase/
       *  milestone/goal to reveal — not just because activeJourneyUser is set, which stays
       *  true for the whole time a reader is anywhere under that actor, including right
       *  after they've clicked the actor's own row to collapse it back to its root.
       *  Without this guard, collapsing clears the resolved path, which re-fires this
       *  effect and immediately re-opens the group the click just closed. */
      setExpandedGroups((prev) => new Set(prev).add(activeJourneyUser));
    }
    if (selectedJourney) setExpandedJourneys((prev) => new Set(prev).add(selectedJourney.id));
    if (selectedPhase) setExpandedPhases((prev) => new Set(prev).add(selectedPhase.id));
    if (selectedMilestone) setExpandedMilestones((prev) => new Set(prev).add(selectedMilestone.id));
    /** journey is included so a deep link to a goal expands its path once the async
     *  /journey.json fetch resolves -- on first mount journey is still empty, so
     *  selectedJourney/selectedPhase/selectedMilestone are undefined and nothing expands;
     *  without this dependency the effect never re-runs once the real journey data arrives. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJourneyUser, resolvedJourneyId, resolvedPhaseId, resolvedMilestoneId, resolvedGoalId, journey]);

  function toggle(set: Set<string>, setSet: (next: Set<string>) => void, key: string) {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setSet(next);
  }

  /** One actor's own row, expanding into its real journey -> phase -> milestone -> goal
   *  tree — unchanged from before the category layer existed. Rendered once per actor,
   *  always nested under its category's own group label. */
  function renderActorRow(actorId: string, label: string, Icon: LucideIcon) {
    const isActorOpen = expandedGroups.has(actorId);
    const journeys = journey.journeys.filter((j) => j.userId === actorId).sort((a, b) => a.order - b.order);
    return (
      <SidebarMenuItem key={actorId}>
        <SidebarMenuButton
          onClick={() => {
            toggle(expandedGroups, setExpandedGroups, actorId);
            /** Only navigate when switching into a different actor. Navigating
             *  to the bare actor root on every click — including a click that's
             *  only meant to collapse the sidebar's own journey list — used to
             *  fight JourneyBoard's own "land on the bare /proof/:user, redirect
             *  to the first journey" behavior: the redirect reinstated the journey
             *  slug in the URL, which made the sidebar re-expand right back open.
             *  A collapse click when this actor is already active shouldn't move
             *  the content pane at all, so the URL never touches the bare root. */
            if (activeJourneyUser !== actorId) navigate(`/proof/${actorId}`);
          }}
          isActive={activeJourneyUser === actorId && !selectedJourney}
          className="font-medium data-[active=true]:font-semibold"
        >
          <BranchIcon isOpen={isActorOpen} />
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-left">{label}</span>
          <SidebarStatusBadge status={statusRollup.actorStatusById.get(actorId)} />
        </SidebarMenuButton>
        {isActorOpen && journeys.length > 0 && (
          <SidebarMenuSub className="ml-3.5 mr-0 pl-2.5 pr-0">
            {journeys.map((oneJourney) => {
              const isJourneyOpen = expandedJourneys.has(oneJourney.id);
              const phases = journey.phases.filter((p) => p.journeyId === oneJourney.id).sort((a, b) => a.order - b.order);
              return (
                <SidebarMenuSubItem key={oneJourney.id}>
                  <SidebarMenuSubButton
                    onClick={() => {
                      toggle(expandedJourneys, setExpandedJourneys, oneJourney.id);
                      navigate(`/proof/${actorId}/${oneJourney.slug}`);
                    }}
                    isActive={oneJourney.id === selectedJourney?.id && !selectedPhase}
                    className="h-auto items-start py-1.5 data-[active=true]:font-medium"
                  >
                    <BranchIcon isOpen={isJourneyOpen} />
                    <Route className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-left text-xs leading-snug flex-1">{oneJourney.name}</span>
                    <SidebarStatusBadge status={statusRollup.journeyStatusById.get(oneJourney.id)} />
                  </SidebarMenuSubButton>
                  {isJourneyOpen && (
                    <SidebarMenuSub className="ml-3.5 mr-0 pl-2.5 pr-0">
                      {phases.map((phase) => {
                        const isPhaseOpen = expandedPhases.has(phase.id);
                        const milestones = journey.milestones.filter((m) => m.phaseId === phase.id).sort((a, b) => a.order - b.order);
                        return (
                          <SidebarMenuSubItem key={phase.id}>
                            <SidebarMenuSubButton
                              onClick={() => {
                                toggle(expandedPhases, setExpandedPhases, phase.id);
                                navigate(`/proof/${actorId}/${oneJourney.slug}/${phase.slug}`);
                              }}
                              isActive={phase.id === selectedPhase?.id && !selectedMilestone}
                              className="h-auto items-start py-1.5 data-[active=true]:font-medium"
                            >
                              <BranchIcon isOpen={isPhaseOpen} />
                              <Flag className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-left text-xs leading-snug">{phase.name}</span>
                              <SidebarStatusBadge status={statusRollup.phaseStatusById.get(phase.id)} />
                            </SidebarMenuSubButton>
                            {isPhaseOpen && (
                              <SidebarMenuSub className="ml-3.5 mr-0 pl-2.5 pr-0">
                                {milestones.map((milestone) => {
                                  const isMilestoneOpen = expandedMilestones.has(milestone.id);
                                  const goals = journey.goals.filter((g) => g.milestoneId === milestone.id).sort((a, b) => a.order - b.order);
                                  return (
                                    <SidebarMenuSubItem key={milestone.id}>
                                      <SidebarMenuSubButton
                                        onClick={() => {
                                          toggle(expandedMilestones, setExpandedMilestones, milestone.id);
                                          navigate(`/proof/${actorId}/${oneJourney.slug}/${phase.slug}/${milestone.slug}`);
                                        }}
                                        isActive={milestone.id === selectedMilestone?.id && !selectedGoal}
                                        className="h-auto items-start py-1.5 data-[active=true]:font-medium"
                                      >
                                        <BranchIcon isOpen={isMilestoneOpen} />
                                        <Milestone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                        <span className="text-left text-xs leading-snug">{milestone.name}</span>
                                        <SidebarStatusBadge status={statusRollup.milestoneStatusById.get(milestone.id)} />
                                      </SidebarMenuSubButton>
                                      {isMilestoneOpen && (
                                        <SidebarMenuSub className="ml-3.5 mr-0 pl-2.5 pr-0">
                                          {goals.map((goal) => (
                                            <SidebarMenuSubItem key={goal.id}>
                                              <SidebarMenuSubButton
                                                onClick={() =>
                                                  navigate(`/proof/${actorId}/${oneJourney.slug}/${phase.slug}/${milestone.slug}/${goal.slug}`)
                                                }
                                                isActive={goal.id === selectedGoal?.id}
                                                className="h-auto items-start py-1.5 data-[active=true]:font-medium"
                                              >
                                                <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                                <span className="text-left text-xs leading-snug">{goal.statement}</span>
                                                <SidebarStatusBadge status={statusRollup.goalStatusById.get(goal.id)} />
                                              </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                          ))}
                                        </SidebarMenuSub>
                                      )}
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
                            )}
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarProvider
      className={`h-full min-h-0 shrink-0 transition-[width] duration-200 ease-linear ${isCollapsed ? 'w-14' : 'w-[380px]'}`}
    >
      {/* The shared Sidebar primitive's own "icon"/"offcanvas" collapsible modes render
       *  as a viewport-fixed overlay, meant for a full app-shell layout paired with
       *  SidebarInset -- not this embedded flex panel. Collapse is handled manually here
       *  instead, by resizing this wrapper and hiding the tree, so the panel stays a
       *  normal, sized flex sibling of the main content pane. */}
      <Sidebar collapsible="none" className="h-full w-full border-r border-sidebar-border">
        <SidebarHeader className="flex-row items-center justify-between p-2">
          {!isCollapsed && <span className="font-medium tracking-tight">Receivables Flow</span>}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft className="size-4" />
          </button>
        </SidebarHeader>
        {!isCollapsed && (
        <SidebarContent className="gap-1 p-2">
          {categoryGroups.map((group) => {
            if (group.actors.length === 0) return null;
            /** Every category always shows its own header, even when it has only one
             *  actor (Market Intelligence) — no folding. A category's own name and its
             *  one actor's name can legitimately be the same text twice; that's still
             *  clearer than deciding row structure differently per category. */
            return (
              <SidebarGroup key={group.categoryId}>
                <SidebarGroupLabel>{group.categoryName}</SidebarGroupLabel>
                <SidebarMenu>
                  {group.actors.map((actor) => renderActorRow(actor.id, ACTOR_LABEL[actor.id] ?? actor.name, ACTOR_ICON[actor.id] ?? Package))}
                </SidebarMenu>
              </SidebarGroup>
            );
          })}
        </SidebarContent>
        )}
      </Sidebar>
    </SidebarProvider>
  );
}
