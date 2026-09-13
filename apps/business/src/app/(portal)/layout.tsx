import deployed from '@rf/contracts-ens/deployed.json';
import { openedAccounts } from '@rf/privy/accounts';
import { PortalShell } from '@/components/privy';
import { NAV } from '@/data/business.data';

/*
 * Rendered per request, not at build time. The account this names is created by provisioning,
 * and a build-time copy of it would be one more number someone wrote down.
 */
export const dynamic = 'force-dynamic';

/**
 * The company's public name, taken from what onboarding actually registered.
 *
 * A portal that displays an identity nobody can resolve is showing a wallet address with extra
 * steps, so this reads the deployment rather than carrying its own spelling of the name.
 */
const ENS_NAME =
  (deployed as { business?: { name: string } }).business?.name ??
  'ironline.business.receivablesflow.eth';

/** The account the name stands for, or nothing if this machine has not provisioned one. */
function wallet(): string | undefined {
  try {
    return openedAccounts().company.address;
  } catch {
    return undefined;
  }
}

/**
 * The chrome all three tabs share.
 *
 * A layout rather than a page, so moving between tabs does not re-mount the sign-in, re-ask
 * Privy who is here, or re-read the wallet — and so each tab's own page is free to fetch only
 * what that tab shows.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      brand="Ironline Freight"
      ens={ENS_NAME}
      wallet={wallet()}
      signer="Anna Reed · Finance Director"
      nav={NAV}
    >
      {children}
    </PortalShell>
  );
}
