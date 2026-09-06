'use client';

import { useState } from 'react';
import { useExportWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** First two letters of the address the fund signs in with. */
function initials(email: string | undefined): string {
  return (email?.slice(0, 2) ?? '··').toUpperCase();
}

function short(address: string | undefined): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'creating…';
}

/**
 * The fund's account, as an avatar in the header.
 *
 * Export opens Privy's own screen rather than one we drew. The private key is
 * shown on an iframe served from Privy's domain, so this app never has access
 * to it.
 */
export function AccountMenu() {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const [copied, setCopied] = useState(false);

  const email = user?.email?.address;
  const address = wallets[0]?.address;

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-[10px] rounded-[2px] border border-transparent px-2 py-1 text-left transition-colors hover:border-[var(--brand-line)]">
        <Avatar className="size-8 rounded-[2px]">
          <AvatarFallback className="rounded-[2px] bg-[var(--surface-2)] font-mono text-[11px] font-medium text-[var(--ink-2)]">
            {initials(email)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[11px] text-[var(--muted-ink)]">Woodgrove Capital</span>
          <span className="block font-mono text-[10.5px] text-[var(--ink-2)]">{short(address)}</span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 rounded-[2px]">
        <div className="px-2 py-1.5">
          <span className="block text-[11px] text-[var(--muted-ink)]">Signed in as</span>
          <span className="block font-mono text-[11px] break-all text-[var(--ink-2)]">{email}</span>
        </div>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <span className="block text-[11px] text-[var(--muted-ink)]">Fund account</span>
          <span className="block font-mono text-[11px] break-all text-[var(--ink-2)]">
            {address ?? 'creating…'}
          </span>
        </div>

        <DropdownMenuItem onSelect={copy} disabled={!address}>
          {copied ? 'Copied' : 'Copy address'}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => exportWallet()} disabled={!address}>
          Export wallet
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => logout()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
