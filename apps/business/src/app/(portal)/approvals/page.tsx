import { BlockView } from '@/components/blocks';
import { SigningApprovals } from '@/components/privy';
import { POLICY } from '@/data/business.data';

export const dynamic = 'force-dynamic';

/**
 * The rule first, then the request under it.
 *
 * The signing policy is true whether or not anything is pending, and the request is one
 * instance of that rule — so the rule leads and the panel that arrives from the network a
 * moment later lands beneath it, rather than rearranging the page while it is read.
 */
export default function ApprovalsPage() {
  return (
    <>
      <BlockView block={POLICY} />
      <SigningApprovals />
    </>
  );
}
