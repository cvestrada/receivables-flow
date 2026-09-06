'use client';

import { usePrivy } from '@privy-io/react-auth';
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

/** The name before the @, which is how the approval record refers to them. */
function who(email: string | undefined): string {
  return email?.split('@')[0] ?? 'director';
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
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-[10px] rounded-[2px] border border-transparent px-2 py-1 text-left transition-colors hover:border-[var(--brand-line)]">
        <Avatar className="size-8 rounded-[2px]">
          <AvatarFallback className="rounded-[2px] bg-[var(--surface-2)] font-mono text-[11px] font-medium text-[var(--ink-2)]">
            {initials(email)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[11px] text-[var(--muted-ink)]">Director</span>
          <span className="block font-mono text-[10.5px] text-[var(--ink-2)]">{who(email)}</span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 rounded-[2px]">
        <div className="px-2 py-1.5">
          <span className="block text-[11px] text-[var(--muted-ink)]">Signed in as</span>
          <span className="block font-mono text-[11px] break-all text-[var(--ink-2)]">{email}</span>
        </div>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <span className="block text-[11px] text-[var(--muted-ink)]">Approves for</span>
          <span className="block text-[11px] text-[var(--ink-2)]">
            Ironline Freight company account
          </span>
          <span className="mt-1 block text-[11px] text-[var(--muted-ink)]">
            Two of three directors must approve.
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => logout()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
