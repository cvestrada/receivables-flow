import { Portal } from '@/components/portal';
import { DEFAULTED, NAV, STAGES } from '@/data/investor.data';

export default function Page() {
  return (
    <Portal
      brand="Woodgrove Capital"
      ens="woodgrove.receivables.eth"
      signer="A. Whitfield · Portfolio Manager"
      nav={NAV}
      stages={STAGES}
      defaulted={DEFAULTED}
    />
  );
}
