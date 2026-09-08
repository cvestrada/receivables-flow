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
      <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--hairline-active)] hover:bg-[var(--surface)]">
        <Avatar className="size-8 rounded-full">
          <AvatarFallback className="rounded-full bg-[var(--accent-subtle)] text-[13px] font-medium text-[var(--accent)]">
            {initials(email)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 leading-tight">
          <span className="block text-[14px] text-[var(--muted)]">Woodgrove Capital</span>
          <span className="block font-mono text-[10.5px] text-[var(--body)]">{short(address)}</span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 rounded-xl">
        <div className="px-2 py-1.5">
          <span className="block text-[14px] text-[var(--muted)]">Signed in as</span>
          <span className="block text-[14px] break-all text-[var(--body)]">{email}</span>
        </div>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <span className="block text-[14px] text-[var(--muted)]">Fund account</span>
          <span className="block text-[14px] break-all text-[var(--body)]">
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
