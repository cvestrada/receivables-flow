'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Shell, type ShellProps } from '@/components/shell';
import { AccountMenu } from '@/components/account-menu';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

/**
 * The portal chrome, behind a sign-in.
 *
 * Woodgrove Capital signs in with an email address and lands in the dashboard with an account
 * already created for them — which is the point of the fund side of the story: a fund starts
 * investing with nothing to install.
 *
 * With no app id configured the portal renders as it does signed in, so the walkthrough still
 * runs without credentials.
 */
export function PortalShell(props: ShellProps) {
  if (!APP_ID) return <Shell {...props} />;

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ['email'],
        appearance: { theme: 'light', accentColor: '#2563EB' },
        /*
         * No wallet for the person signing in.
         *
         * Woodgrove has one account — the wallet provisioning opened for it, which holds the
         * receivable and pays for it. Privy was creating a second, personal, empty wallet for
         * whoever logged in, which nothing used and which put a third address on a screen that
         * should only ever show the fund's.
         */
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
      }}
    >
      <Gate {...props} />
    </PrivyProvider>
  );
}

function Gate(props: ShellProps) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <main className="flex min-h-svh items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
        {/* The product's own mark, from assets/receivables-flow-logo.svg. */}
        <img src="/receivables-flow-logo.svg" alt="Receivables Flow" className="h-14 w-auto" />
        <h1 className="text-[28px] font-semibold tracking-[-.02em] text-[var(--ink)]">
          {props.brand}
        </h1>
        <p className="max-w-sm text-[16px] text-[var(--body)]">
          Sign in with an email address. Your account is created for you — no extension, no seed
          phrase.
        </p>
        <Button onClick={login}>Sign in</Button>
      </main>
    );
  }

  return <Shell {...props} account={<AccountMenu />} />;
}
