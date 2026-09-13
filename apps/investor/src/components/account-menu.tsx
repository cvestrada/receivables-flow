'use client';

import { usePrivy } from '@privy-io/react-auth';
import { initialsFor, nameFromEmail } from '@rf/privy/policies';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function initials(email: string | undefined): string {
  return email ? initialsFor(nameFromEmail(email)) : '··';
}

/** How the fund refers to whoever is at the keyboard. */
function who(email: string | undefined): string {
  return email ? nameFromEmail(email) : 'portfolio manager';
}

/**
 * Who is signed in, and how to leave.
 *
 * Nothing about an account here. The fund has exactly one — the wallet provisioning opened for
 * it — and that is in the bar above, behind the ENS name that resolves to it. This used to print
 * the signed-in person's own embedded wallet under the heading "Fund account", which is how a
 * fund with one account came to show three addresses on one screen.
 */
export function AccountMenu() {
  const { user, logout } = usePrivy();

  const email = user?.email?.address;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--hairline-active)] hover:bg-[var(--surface)]">
        <Avatar className="size-8 rounded-full">
          <AvatarFallback className="rounded-full bg-[var(--accent-subtle)] text-[13px] font-medium text-[var(--accent)]">
            {initials(email)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 leading-tight">
          {/*
            * The person, not an account. The address this hook returns is the signed-in user's
            * own embedded wallet — it is not Woodgrove's, it holds nothing, and printing it
            * beside the fund's name put a third address on screen for a fund that has one. The
            * fund's account is in the bar above, behind its ENS name.
            */}
          <span className="block truncate text-[14px] text-[var(--body)]">{who(email)}</span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 rounded-xl">
        <div className="px-2 py-1.5">
          <span className="block text-[14px] text-[var(--muted)]">Signed in as</span>
          <span className="block text-[14px] break-all text-[var(--body)]">{email}</span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => void logout()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
