import { Allocate } from '@/components/allocate';
import { PrivyPortal } from '@/components/privy';
import { NAV, buildDefaulted, buildStages } from '@/data/investor.data';
import { investorPass } from '@/lib/ens/pass';

/*
 * Rendered per request rather than at build time. The pass is a live fact with a date on it,
 * and a page baked at build time would go on claiming the fund was cleared long after the
 * registry stopped saying so.
 */
export const dynamic = 'force-dynamic';

export default async function Page() {
  const pass = await investorPass();

  return (
    <PrivyPortal
      brand="Woodgrove Capital"
      ens={pass.name}
      signer="A. Whitfield · Portfolio Manager"
      nav={NAV}
      stages={buildStages(pass)}
      defaulted={buildDefaulted(pass)}
      live={{ compliance: <Allocate /> }}
    />
  );
}
