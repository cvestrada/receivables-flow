'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, ChevronDown, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ResetDemo } from '@/components/reset-demo';
import { useState } from 'react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';

import type { NavItem } from '@/data/portal.types';

export interface ShellProps {
  brand: string;
  ens: string;
  /** The wallet the name stands for — the account that actually signs and holds. */
  wallet?: string;
  signer: string;
  /** Replaces the static signer line once a real account is signed in. */
  account?: React.ReactNode;
  nav: NavItem[];
  children: React.ReactNode;
}

/**
 * The chrome every tab sits inside: the bar, the sidebar, and who is at the keyboard.
 *
 * Which tab is open is a route now, not a piece of state. It used to be one page holding all
 * three sections and swapping between them, which meant the browser's own back button did
 * nothing, no tab could be linked to, and every section's data was fetched whether or not
 * anyone looked at it. Each tab is its own URL, so each one fetches only what it shows.
 */
export function Shell({ brand, ens, wallet, signer, account, nav, children }: ShellProps) {
  const pathname = usePathname();
  const active = nav.find((item) => pathname.startsWith(item.href)) ?? nav[0];

  return (
    <div className="flex h-svh min-h-0 flex-col">
      {/*
        * One bar across the whole window, above the sidebar rather than beside it.
        *
        * It answers the two questions a viewer cutting between three tabs actually has: whose
        * desk is this, and which side of the trade are they on. The company's name leads, the
        * side is a chip in that side's own colour, and the resolvable name sits at the far
        * right where an address bar would be.
        */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-[#FAFAFA] px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-[17px] font-semibold tracking-[-.02em] text-[var(--ink)]">
            {brand}
          </span>
          <span className="shrink-0 rounded-md bg-[#DBE7FB] px-2 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#11438A] uppercase">
            Investor
          </span>
        </div>

        <Identity ens={ens} wallet={wallet} />
      </header>

      <SidebarProvider className="min-h-0 flex-1" style={{ ['--sidebar-width' as string]: '248px' }}>
        <Sidebar collapsible="none" className="h-full border-r bg-[#FAFAFA]">
          <SidebarContent className="px-0">
            <SidebarGroup className="gap-1.5 px-2.5 pt-4 pb-0">
              <SidebarGroupLabel className="eyebrow h-auto px-2.5 pb-1">Dashboard</SidebarGroupLabel>
              <SidebarMenu className="gap-px">
                {nav.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      render={<Link href={item.href}>{item.label}</Link>}
                      isActive={item.href === active.href}
                      className="h-auto cursor-pointer rounded-[7px] px-3 py-2 text-[15px] data-[active=true]:font-medium data-[active=true]:text-[var(--accent)]"
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="mt-auto gap-3 px-5 py-4">
            <ResetDemo />
            <div className="flex items-center gap-2.5 text-[14px] leading-normal text-[var(--body)]">
              {account ?? (
                <>
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[13px] font-medium text-[var(--accent)]"
                  >
                    {signer.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate">{signer.split(' · ')[0]}</span>
                </>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex h-full min-w-0 flex-col overflow-hidden bg-[var(--background)]">
          <div className="min-w-0 flex-1 overflow-y-auto px-8 pt-8 pb-12">
            <div className="mx-auto max-w-[980px]">
              {/*
                * The title alone. Every tab carried a sentence under it restating its own name —
                * "Invoices · What is owed, and what has been financed" — which is a caption for a
                * screen that has not been designed to speak for itself.
                */}
              <h1 className="mb-6 text-[28px] leading-[1.1] font-semibold tracking-[-.02em] text-[var(--ink)]">
                {active.label}
              </h1>

              <div className="flex min-w-0 flex-col gap-5">{children}</div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

/**
 * The name in the bar, and what is behind it.
 *
 * A name is the point of putting an identity on ENS, and a wallet address is the point of it
 * being a crypto product — so the chip shows the name and opens onto the address it stands for.
 *
 * A `details` element did this until it did it badly: it closed on any mouse-out, including a
 * mouse travelling towards the Copy button, and stayed open when the page moved under it. A
 * popover is the control this actually is — it opens on click, closes on click-away or Escape,
 * and keeps focus where a keyboard left it.
 */
function Identity({ ens, wallet }: { ens: string; wallet?: string }) {
  const [copied, setCopied] = useState(false);

  /** Enough of an address to recognise, short enough to read. The whole of it is copied. */
  const short = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'not provisioned';

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border bg-[var(--surface)] px-2.5 py-[5px] text-[15px] font-medium text-[var(--body)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <span
              aria-hidden
              className="flex size-[18px] items-center justify-center rounded-full bg-[#DBE7FB] text-[11px] leading-none text-[#11438A]"
            >
              🏦
            </span>
            <span className="tabular-nums text-[var(--ink)]">{ens}</span>
            <ChevronDown aria-hidden className="size-3.5 text-[var(--muted)]" />
          </button>
        }
      />

      <PopoverContent align="end" className="w-[22rem] rounded-xl p-3">
        <div className="eyebrow text-[11px]">Wallet behind this name</div>
        <div className="mt-1 flex items-center gap-2">
          <code
            data-testid="identity-wallet"
            title={wallet}
            className="min-w-0 flex-1 truncate rounded-md bg-[var(--surface-alt)] px-2 py-1.5 text-[13px] tabular-nums text-[var(--ink)]"
          >
            {short}
          </code>
          <Button
            variant="outline"
            size="sm"
            disabled={!wallet}
            onClick={() => {
              if (!wallet) return;
              void navigator.clipboard.writeText(wallet).then(() => setCopied(true));
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <a
          href={`https://hackathon-deployment-portal-app.ens-cf.workers.dev/${ens}/records`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1.5 text-[14px] font-medium text-[var(--accent)] hover:underline"
        >
          Open on ENS
          <ExternalLink className="size-3.5" />
        </a>
      </PopoverContent>
    </Popover>
  );
}
