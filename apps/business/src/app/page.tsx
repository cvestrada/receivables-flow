import { PrivyPortal } from '@/components/privy';
import { DEFAULTED, NAV, STAGES } from '@/data/business.data';

export default function Page() {
  return (
    <PrivyPortal
      brand="Ironline Freight"
      ens="ironline.receivables.eth"
      signer="Anna Reed · Finance Director"
      nav={NAV}
      stages={STAGES}
      defaulted={DEFAULTED}
    />
  );
}
