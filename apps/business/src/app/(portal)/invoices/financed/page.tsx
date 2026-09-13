import { Financed } from '@/components/financed';
import { BookedRepayment } from '@/components/quote';
import { Repay } from '@/components/repay';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { quote } from '@/lib/hedera-ats/quote';
import { owedAtMaturity } from '@/lib/hedera-ats/repay';
import { invoiceView, readSubmission, statusOf } from '@/lib/submission';

export const dynamic = 'force-dynamic';

/**
 * What the invoice became, once two directors signed and Hedera minted it.
 *
 * Nothing renders here before that. An invoice that has only been asked about has no price it
 * was sold at, no holders and no maturity to count down — and a page that showed those anyway
 * would be describing a deal that had not happened.
 */
export default async function FinancedPage() {
  const held = readSubmission();
  const status = statusOf(held);

  if (status !== 'tokenized') {
    return (
      <Empty className="rounded-xl border bg-[var(--surface)]">
        <EmptyHeader>
          <EmptyTitle>Nothing financed yet</EmptyTitle>
          <EmptyDescription>
            {status === 'requested'
              ? 'INV-2026-0417 is waiting on its second signature. It appears here once the receivable is minted.'
              : 'Submit INV-2026-0417 for financing and what it became appears here.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const [priced, owed] = await Promise.all([quote(), owedAtMaturity()]);

  return (
    <Financed
      invoice={invoiceView()}
      quote={priced}
      holders={owed.holders}
      hash={held.hash}
      at={held.at}
      repay={
        <>
          {/* What the network booked at the moment of sale, then the payment itself. */}
          <BookedRepayment />
          <Repay view={owed} today={priced} />
        </>
      }
    />
  );
}
