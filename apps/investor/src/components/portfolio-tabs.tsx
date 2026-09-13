'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/portfolio/offered', label: 'Offered' },
  { href: '/portfolio/held', label: 'Held' },
];

/**
 * What the fund is offered, and what it holds — the two things a portfolio is.
 *
 * Routes rather than local state, so a judge can be sent straight to either one and the back
 * button behaves. Funding lives on the first; selling on the second. One page carrying both
 * was the offer, the position, three prices and two buttons in a single column of prose.
 */
export function PortfolioTabs() {
  const pathname = usePathname();

  return (
    <div className="flex w-fit gap-1 rounded-lg bg-[var(--surface-alt)] p-1">
      {TABS.map((tab) => {
        const on = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-[14px] transition-colors ${
              on
                ? 'bg-[var(--surface)] font-medium text-[var(--ink)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--muted)] hover:text-[var(--body)]'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
