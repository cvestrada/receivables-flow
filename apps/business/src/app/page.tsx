import { PrivyPortal } from '@/components/privy';
import { BookedRepayment, Quote } from '@/components/quote';
import { Repay } from '@/components/repay';
import { DEFAULTED, NAV, STAGES } from '@/data/business.data';
import { quote } from '@/lib/hedera-ats/quote';
import { owedAtMaturity } from '@/lib/hedera-ats/repay';

/*
 * Rendered per request, not at build time. The price on this page is only worth showing
 * because it is what the chain says right now; baked into the build it would be one more
 * number someone wrote down.
 */
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [owed, today] = await Promise.all([owedAtMaturity(), quote()]);

  return (
    <PrivyPortal
      brand="Ironline Freight"
      ens="ironline.receivables.eth"
      signer="Anna Reed · Finance Director"
      nav={NAV}
      stages={STAGES}
      defaulted={DEFAULTED}
      /*
       * Rendered here rather than inside the portal because both read the chain, and the
       * portal is a client component that cannot. They arrive already rendered.
       */
      live={{
        receivables: (
          <>
            <Quote />
            <BookedRepayment />
            {/* Priced here as well as in the quote above, because day 60 has to be able to
                say what the invoice cost before it happened. */}
            <Repay view={owed} today={today} />
          </>
        ),
      }}
    />
  );
}
