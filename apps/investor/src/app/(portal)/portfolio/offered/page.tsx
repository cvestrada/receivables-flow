import { Offered } from '@/components/offer';
import { issuerScore } from '@/lib/ens/score';
import { offered } from '@/lib/hedera-ats/offer';

export const dynamic = 'force-dynamic';

/** What is offered to this fund — read off the receivable, not off a walkthrough. */
export default async function OfferedPage() {
  const score = await issuerScore();
  const offer = await offered(score.value ?? null);

  return <Offered offer={offer} />;
}
