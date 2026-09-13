import { openedAccounts } from '@rf/privy/accounts';
import { PortalShell } from '@/components/privy';
import { NAV } from '@/data/investor.data';
import { investorPass } from '@/lib/ens/pass';

/*
 * Rendered per request rather than at build time. The pass is a live fact with a date on it,
 * and a layout baked at build time would go on naming a fund the registry had stopped
 * recognising.
 */
export const dynamic = 'force-dynamic';

/**
 * The fund's own account, or nothing if this machine has not provisioned one.
 *
 * The fund's wallet rather than the one on its ENS pass: the pass says who may hold a
 * receivable, and this is the account that actually pays for one.
 */
function wallet(): string | undefined {
  try {
    return openedAccounts().fund.address;
  } catch {
    return undefined;
  }
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const pass = await investorPass();

  return (
    <PortalShell
      brand="Woodgrove Capital"
      ens={pass.name}
      wallet={wallet()}
      signer="A. Whitfield · Portfolio Manager"
      nav={NAV}
    >
      {children}
    </PortalShell>
  );
}
