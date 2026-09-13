import { Section } from '@/components/section';
import { fundState } from '@/lib/stages';

export const dynamic = 'force-dynamic';

/**
 * What this fund may buy, and what it may not.
 *
 * The rule only, with nothing on it to press — the same shape as the business's Approvals tab.
 * Allocating used to happen here, which put the buttons that move money on the page that
 * explains the policy and left the page about positions with nothing to do on it. Money moves
 * where the receivable is, which is Portfolio.
 */
export default async function MandatePage() {
  const { stages } = await fundState();

  return <Section stages={stages} section="mandate" />;
}
