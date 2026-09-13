'use client';

import { useEffect, useState } from 'react';
import { BlockView } from '@/components/blocks';
import type { Stage } from '@/data/portal.types';

/**
 * One tab of the fund's dashboard, at the moment of the cycle it is being read at.
 *
 * The moments are still walked with the arrow keys — funding, the resale and the repayment are
 * the business's and the network's actions, and a fund portal that claimed to know when each
 * had happened would be guessing. What it will not do is render a live panel over an empty
 * tab: a resale price for a position nobody holds is a number with nothing behind it.
 */
export function Section({
  stages,
  section,
  live,
}: {
  stages: Stage[];
  section: string;
  live?: React.ReactNode;
}) {
  const [step, setStep] = useState(0);
  const last = stages.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      setStep((at) => Math.max(0, Math.min(last, at + (event.key === 'ArrowRight' ? 1 : -1))));
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  const blocks = stages[step].sections[section] ?? [];
  const nothingYet = blocks.length > 0 && blocks.every((block) => block.t === 'empty');

  return (
    <>
      {!nothingYet && live}
      {blocks.map((block, i) => (
        <BlockView key={`${step}-${i}`} block={block} />
      ))}
    </>
  );
}
