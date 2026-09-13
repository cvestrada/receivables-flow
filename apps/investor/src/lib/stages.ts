import { buildStages } from '@/data/investor.data';
import { investorPass } from '@/lib/ens/pass';
import { issuerScore } from '@/lib/ens/score';
import { resale } from '@/lib/hedera-ats/resale';
import { resaleQuote } from '@/lib/hedera-ats/resale-quote';

/**
 * Everything the fund's tabs are built from, read once per request.
 *
 * The pass, the issuer's score and what the receivable's balances say are three chain reads
 * that every tab's content depends on. Gathered here so each route asks for them the same way
 * and so the resale price a page shows is the one its own blocks were built from.
 */
export async function fundState() {
  const [pass, score] = await Promise.all([investorPass(), issuerScore()]);
  const quote = await resaleQuote(score);
  const split = await resale(quote.today.priceUsd);

  return { pass, score, quote, split, stages: buildStages(pass, score, split) };
}
