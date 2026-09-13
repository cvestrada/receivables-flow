import { ResalePrice } from '@/components/resale-price';
import { Resell } from '@/components/resell';
import { fundState } from '@/lib/stages';

export const dynamic = 'force-dynamic';

/**
 * What the fund holds, what it could sell it for today, and the button that sells it.
 *
 * Both panels read the receivable's own balances, so they are the position: there is no
 * stage copy under them to repeat it.
 */
export default async function HeldPage() {
  const { quote, split } = await fundState();

  return (
    <>
      <ResalePrice quote={quote} />
      <Resell view={split} />
    </>
  );
}
