import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProofSidebar from './components/ProofSidebar.js';
import JourneyBoard from './components/JourneyBoard.js';
import { resolveProofPath } from './components/proof-path-resolver.util.js';
import type { ProofPathJourneyTreeData } from './components/proof-path-resolver.util.js';

const EMPTY_ROUTING_DATA: ProofPathJourneyTreeData = { journeys: [], phases: [], milestones: [], goals: [] };

function Dashboard() {
  const [routingData, setRoutingData] = useState<ProofPathJourneyTreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  /** The router's own narrow slice of `/journey.json` -- just enough to walk a slug path
   *  down to its matched journey/phase/milestone/goal. ProofSidebar and JourneyBoard each
   *  still fetch the full payload themselves for their own rendering needs. */
  useEffect(() => {
    fetch('/journey.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load journey.json: ${r.status}`);
        return r.json() as Promise<ProofPathJourneyTreeData>;
      })
      .then(setRoutingData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const parts = location.pathname.split('/').filter(Boolean);
  const actorId = parts[0] === 'proof' ? parts[1] : undefined;
  const segments = parts.slice(2);
  const resolved = actorId
    ? resolveProofPath({ userId: actorId, segments, journey: routingData ?? EMPTY_ROUTING_DATA })
    : {};

  return (
    <div className="h-screen flex flex-col bg-white font-sans text-sm text-gray-900">
      <main className="relative flex-1 min-h-0 overflow-hidden flex">
        {error && (
          <div className="p-6 text-red-600 text-sm">
            <p className="font-medium">Could not load journey data</p>
            <p className="mt-1 text-gray-500">{error}</p>
          </div>
        )}
        {!error && !routingData && <div className="p-6 text-gray-400 text-sm">Loading…</div>}
        {routingData && (
          <>
            <ProofSidebar
              activeJourneyUser={actorId}
              resolvedJourneyId={resolved.journey?.id}
              resolvedPhaseId={resolved.phase?.id}
              resolvedMilestoneId={resolved.milestone?.id}
              resolvedGoalId={resolved.goal?.id}
            />
            <div className="relative flex-1 min-w-0 min-h-0">
              <Routes>
                <Route index element={<Navigate to="/proof" replace />} />
                <Route path="/proof" element={<Navigate to="/proof/business" replace />} />
                <Route
                  path="/proof/:user/*"
                  element={
                    <JourneyBoard
                      actorId={actorId}
                      journeySlug={resolved.journey?.slug}
                      scrollTargetId={resolved.milestone?.id ?? resolved.phase?.id}
                    />
                  }
                />
              </Routes>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
