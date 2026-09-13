'use client';

import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SubmitWizard, type InvoiceView } from '@/components/submit-wizard';
import type { QuoteView } from '@/components/financed';

/**
 * What Ironline is owed and has not sold.
 *
 * One row, and the button that starts the request. The price is not on this screen on purpose:
 * a business looking at what it is owed is not yet asking what it would cost to sell, and
 * putting the answer here made every invoice look like it had already been quoted.
 *
 * An invoice that has been asked about and not yet signed looks no different, because to the
 * business it is not: nothing has been sold until the second signature lands and the receivable
 * is minted. Pressing Submit again reopens the same request where it left off.
 */
export function Outstanding({ invoice, quote }: { invoice: InvoiceView; quote: QuoteView }) {
  return (
    <Card data-testid="outstanding-invoice">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-medium text-[var(--ink)]">{invoice.id}</span>
          <span className="text-[14px] text-[var(--muted)]">
            {invoice.customer} · {invoice.terms}
          </span>
        </div>

        <div className="flex items-center gap-5">
          <a
            href={invoice.document}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--accent)] hover:underline"
          >
            <FileText className="size-4" />
            {invoice.id}.pdf ↗
          </a>

          <span className="text-[19px] font-semibold tabular-nums text-[var(--ink)]">
            {invoice.amount}
          </span>

          <SubmitWizard invoice={invoice} quote={quote} />
        </div>
      </CardContent>
    </Card>
  );
}
