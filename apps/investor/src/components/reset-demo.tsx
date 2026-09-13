'use client';

import { Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The reset lives on the business portal, because the state it forgets lives there.
 *
 * This portal keeps nothing of its own: what it shows is read off the chains. So its reset
 * button calls the other portal's route, on the origin the two are served from in the demo.
 */
const BUSINESS = process.env.NEXT_PUBLIC_BUSINESS_PORTAL_URL ?? 'http://localhost:3200';

/**
 * One button that puts the demo back to its first screen.
 *
 * Small and grey, in the corner: it exists for the person running the demo, not for the story.
 * What it resets is written on the route it calls; what a viewer needs to know is that pressing
 * it takes about a minute because two of the resets are transactions on public chains.
 */
export function ResetDemo() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch(`${BUSINESS}/api/demo`, { method: 'POST' });
      const report = (await response.json()) as { ens?: unknown; hedera?: unknown };
      const ensFailed = typeof report.ens === 'object' && report.ens && 'failed' in report.ens;
      const hederaFailed =
        typeof report.hedera === 'object' && report.hedera && 'failed' in report.hedera;
      setNote(ensFailed || hederaFailed ? 'reset partly — see the console' : 'reset');
      if (ensFailed || hederaFailed) console.warn('demo reset', report);
      router.push('/portfolio/offered');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      data-testid="reset-demo"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={reset}
      className="justify-start text-[13px] text-[var(--muted)]"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
      {busy ? 'Resetting… about a minute' : (note ?? 'Reset demo')}
    </Button>
  );
}
