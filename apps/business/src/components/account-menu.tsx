'use client';

import { usePrivy } from '@privy-io/react-auth';
import { nameFromEmail } from '@rf/privy/policies';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** First two letters of the address this director signs in with. */
function initials(email: string | undefined): string {
  return (email?.slice(0, 2) ?? '··').toUpperCase();
}

/** How the approval record refers to them. */
function who(email: string | undefined): string {
  return email ? nameFromEmail(email) : 'director';
}

/**
 * The signed-in director, as an avatar in the header.
 *
 * There is no account of their own to show. A director approves what the
 * company account does, so the only thing worth naming here is which of the
 * three is at the keyboard.
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
          <span className="eyebrow block text-[12px]">Director</span>
          <span className="block truncate text-[14px] text-[var(--ink)]">{who(email)}</span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 rounded-xl">
        <div className="px-2 py-1.5">
          <span className="block text-[14px] text-[var(--muted)]">Signed in as</span>
          <span className="block text-[14px] break-all text-[var(--body)]">{email}</span>
        </div>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <span className="block text-[14px] text-[var(--muted)]">Approves for</span>
          <span className="block text-[14px] text-[var(--body)]">
            Ironline Freight company account
          </span>
          <span className="mt-1 block text-[14px] text-[var(--muted)]">
            Two of three directors must approve.
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => logout()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
