'use client';

import { PrivyProvider, useAuthorizationSignature, usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Portal, type PortalProps } from '@/components/portal';
import { AccountMenu } from '@/components/account-menu';
import { Approvals } from '@/components/approvals';

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

/**
 * The portal, behind a sign-in.
 *
 * Each director signs in with their own email and lands in the dashboard, so
 * the portal can tell them apart — which is what makes two of three approvals
 * mean anything at all.
 *
 * Directors get no account of their own. They approve what the company account
 * does; a personal wallet for each of them would mean nothing here.
 *
 * With no app id configured the portal renders as it did before, so the
 * hardcoded walkthrough still runs without credentials.
 */
export function PrivyPortal(props: PortalProps) {
  /*
   * With no app id there is no director to sign as, so the Approvals section still
   * shows where the sale stands and can still send it — it just cannot add an
   * approval. That is the honest state, and it is the one the walkthrough runs in.
   */
  if (!APP_ID) return <Portal {...props} live={{ approvals: <Approvals /> }} />;

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ['email'],
        appearance: { theme: 'light', accentColor: '#635BFF' },
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
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
      <main className="flex min-h-svh items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="eyebrow">
          Receivables <span className="text-[var(--accent)]">Flow</span>
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-.02em] text-[var(--ink)]">{props.brand}</h1>
        <p className="max-w-sm text-[16px] text-[var(--body)]">
          Sign in with an email address. Two of the three directors must approve before the company account will
          sell an invoice.
        </p>
        <Button onClick={login}>Sign in</Button>
      </main>
    );
  }

  return <Portal {...props} account={<AccountMenu />} live={{ approvals: <SigningApprovals /> }} />;
}

/** The name before the @, which is how the approval record refers to a director. */
function who(email: string | undefined): string {
  return email?.split('@')[0] ?? 'director';
}

/**
 * The Approvals section with a signed-in director behind it.
 *
 * The signature is taken here, in the director's own browser, over the exact sale
 * the panel above is showing. Nothing about the sale is re-described on the way —
 * a second description would be a second sale as far as the company account is
 * concerned, and the two approvals would never meet.
 */
function SigningApprovals() {
  const { user } = usePrivy();
  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const name = who(user?.email?.address);

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
