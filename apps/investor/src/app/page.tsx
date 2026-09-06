import { PrivyPortal } from '@/components/privy';
import { DEFAULTED, NAV, STAGES } from '@/data/investor.data';

export default function Page() {
  return (
    <PrivyPortal
      brand="Woodgrove Capital"
      ens="woodgrove.receivables.eth"
      signer="A. Whitfield · Portfolio Manager"
      nav={NAV}
      stages={STAGES}
      defaulted={DEFAULTED}
    />
  );
}
