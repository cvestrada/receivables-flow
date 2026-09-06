import { Portal } from '@/components/portal';
import { DEFAULTED, NAV, STAGES } from '@/data/business.data';

export default function Page() {
  return (
    <Portal
      brand="Ironline Freight"
      ens="ironline.receivables.eth"
      signer="R. Okonjo · Director"
      nav={NAV}
      stages={STAGES}
      defaulted={DEFAULTED}
    />
  );
}
