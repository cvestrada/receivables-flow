'use client';

import { PrivyProvider, useAuthorizationSignature, usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Shell, type ShellProps } from '@/components/shell';
import { AccountMenu } from '@/components/account-menu';
import { Approvals } from '@/components/approvals';
import { Seat } from '@/components/seat';
import { nameFromEmail } from '@rf/privy/policies';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

/**
 * The portal chrome, behind a sign-in.
 *
 * Each director signs in with their own email and lands in the dashboard, so the portal can
 * tell them apart — which is what makes two of three approvals mean anything at all.
 *
 * Directors get no account of their own. They approve what the company account does; a personal
 * wallet for each of them would mean nothing here.
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
        appearance: { theme: 'light', accentColor: '#D9641E' },
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
          Sign in with an email address. Two of the three directors must approve before the
          company account will sell an invoice.
        </p>
        <Button onClick={login}>Sign in</Button>
      </main>
    );
  }

  /*
   * The seat is still taken on sign-in — it is what makes this person's signature count — but it
   * is no longer announced. It said in two sentences what the signing step says in three named
   * rows, and a banner explaining the rule sat above every screen that had nothing to do with it.
   */
  return (
    <Shell
      {...props}
      account={
        <>
          <Seat />
          <AccountMenu />
        </>
      }
    />
  );
}

/**
 * The Approvals section, with a signed-in director behind it when there is one.
 *
 * The signature is taken in the director's own browser, over the exact sale the panel is
 * showing. Nothing about the sale is re-described on the way — a second description would be a
 * second sale as far as the company account is concerned, and the two approvals would never
 * meet. With no app configured it still reads and sends the record; it simply cannot add a
 * signature, which is the honest state and the one the walkthrough runs in.
 */
export function SigningApprovals() {
  if (!APP_ID) return <Approvals />;

  return <WithDirector />;
}

function WithDirector() {
  const { user } = usePrivy();
  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const name = user?.email?.address ? nameFromEmail(user.email.address) : 'director';

  return (
    <Approvals
      signedInAs={name}
      approve={async (sale) => {
        const { signature } = await generateAuthorizationSignature(sale as never);
        return { userId: user?.id ?? '', name, signature };
      }}
    />
  );
}
