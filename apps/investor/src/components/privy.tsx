'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Portal, type PortalProps } from '@/components/portal';
import { AccountMenu } from '@/components/account-menu';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

/**
 * The portal, behind a sign-in.
 *
 * Woodgrove Capital signs in with an email address and lands in the dashboard
 * with an account already created for them — which is the point of the fund
 * side of the story: a fund starts investing with nothing to install.
 *
 * With no app id configured the portal renders as it did before, so the
 * hardcoded walkthrough still runs without credentials.
 */
export function PrivyPortal(props: PortalProps) {
  if (!APP_ID) return <Portal {...props} />;

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ['email'],
        appearance: { theme: 'dark', accentColor: '#c8a24a' },
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
      }}
    >
      <Gate {...props} />
    </PrivyProvider>
  );
}

function Gate(props: PortalProps) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <main className="flex min-h-svh items-center justify-center text-sm text-[var(--muted-ink)]">
        Loading…
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="font-heading text-[10.5px] font-bold tracking-[.16em] uppercase text-[var(--muted-ink)]">
          Receivables <span className="text-[var(--brand)]">Flow</span>
        </div>
        <h1 className="font-heading text-2xl font-semibold text-[var(--ink)]">{props.brand}</h1>
        <p className="max-w-sm text-sm text-[var(--muted-ink)]">
          Sign in with an email address. Your account is created for you — no extension, no seed
          phrase.
        </p>
        <Button onClick={login}>Sign in</Button>
      </main>
    );
  }

  return <Portal {...props} account={<AccountMenu />} />;
}
