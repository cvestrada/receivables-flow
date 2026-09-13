'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/invoices/outstanding', label: 'Outstanding' },
  { href: '/invoices/financed', label: 'Financed' },
];

/**
 * The two halves of an invoice's life, split where the money changes hands.
 *
 * Routes rather than local state, so a judge can be sent straight to either one and the back
 * button behaves. The invoice appears under exactly one of them at a time: it is outstanding
 * until the receivable is minted, and financed afterwards.
 */
export function InvoiceTabs() {
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
