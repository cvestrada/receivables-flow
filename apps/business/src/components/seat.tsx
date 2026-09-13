'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

/** What the seating route answers with. */
interface Seat {
  seated: boolean;
  seat?: string;
  required?: number;
  of?: number;
  reason?: string;
}

/**
 * Takes the signed-in person's seat on Ironline Freight's company wallet.
 *
 * Two of the three seats are fixed — a director with her own login, and the company's finance
 * system. The third is handed to whoever signs in, which is why a stranger can open this demo
 * and be one of the two signatures a financing takes.
 *
 * Asked for on sign-in rather than on a button, because holding a seat is a fact about being
 * signed in, not an action. It renders nothing: the banner it used to show restated the signing
 * rule above every screen, including the ones with nothing to sign. Where the seat matters —
 * the signing step of a financing — the rows are named, and a seat that failed to be granted
 * shows there as a signature that will not count.
 *
 * The result is left on the element as a data attribute so a test can still assert that Privy
 * granted it, without a person having to read an announcement they did not need.
 */
export function Seat() {
  const { user, authenticated } = usePrivy();
  const [seat, setSeat] = useState<Seat | null>(null);

  useEffect(() => {
    if (!authenticated || !user?.id) return;

    let live = true;
    void fetch('/api/director', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
      .then((response) => response.json() as Promise<Seat>)
      .then((answer) => {
        if (live) setSeat(answer);
      })
      .catch((error: unknown) => {
        if (live) setSeat({ seated: false, reason: String(error) });
      });

    return () => {
      live = false;
    };
  }, [authenticated, user?.id]);

  if (!seat) return null;

  return (
    <span
      hidden
      data-testid="director-seat"
      data-seated={seat.seated}
      data-reason={seat.reason}
    />
  );
}
