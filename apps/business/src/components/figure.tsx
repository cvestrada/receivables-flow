'use client';

import { useEffect, useRef, useState } from 'react';

const MONEY = /^(−?)\$?([\d,]+)$/;

/**
 * Shows one headline number, counting from the value it previously held.
 *
 * Only plain money strings animate. Anything else — a date, "7 of 7", an em dash —
 * is swapped outright, because interpolating between two of those produces figures
 * that were never true at any point in the deal.
 */
export function Figure({ value, tone }: { value: string; tone?: string }) {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = MONEY.exec(previous.current);
    const to = MONEY.exec(value);
    previous.current = value;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!from || !to || reduced) {
      setShown(value);
      return;
    }

    const a = parseInt(from[2].replace(/,/g, ''), 10) * (from[1] ? -1 : 1);
    const b = parseInt(to[2].replace(/,/g, ''), 10) * (to[1] ? -1 : 1);
    if (a === b) {
      setShown(value);
      return;
    }

    const dollars = value.includes('$');
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 620);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(a + (b - a) * eased);
      setShown(`${v < 0 ? '−' : ''}${dollars ? '$' : ''}${Math.abs(v).toLocaleString('en-US')}`);
      if (p < 1) frame = requestAnimationFrame(tick);
      else setShown(value);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={`figure block text-[26px] leading-none tone-${tone ?? ''}`}>{shown}</span>;
}
