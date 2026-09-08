'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';

import { BlockView } from '@/components/blocks';
import type { NavItem, Stage } from '@/data/portal.types';

const REPLAY_MS = 2600;

export interface PortalProps {
  brand: string;
  ens: string;
  signer: string;
  /** Replaces the static signer line once a real account is signed in. */
  account?: React.ReactNode;
  /*
   * Live content for a section, keyed by nav id and rendered above that section's
   * panels. The walkthrough's panels are literals in a data module and cannot hold
   * a component, so anything that talks to a real account arrives through here —
   * and a section given nothing renders exactly as it does today.
   */
  live?: Record<string, React.ReactNode>;
  nav: NavItem[];
  stages: Stage[];
  defaulted: Stage;
  /** Which moment the portal opens on — the deal is most legible mid-flight. */
  openAt?: number;
}

export function Portal({ brand, ens, signer, account, live, nav, stages, defaulted, openAt = 3 }: PortalProps) {
  const [moment, setMoment] = useState(openAt);
  const [section, setSection] = useState(nav[0].id);
  const [broke, setBroke] = useState(false);
  const [playing, setPlaying] = useState(false);
  const last = stages.length - 1;

  /*
   * The unhappy ending is a variant of the final moment rather than a seventh stop,
   * so stepping away from the end quietly clears it — otherwise the timeline would
   * claim day 20 while the screen still showed a default.
   */
  const stage = broke && moment === last ? defaulted : stages[moment];

  const goto = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(last, next));
      setMoment(clamped);
      if (clamped !== last) setBroke(false);
    },
    [last],
  );

  const halt = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setMoment((m) => {
        if (m >= last) {
          setPlaying(false);
          return m;
        }
        return m + 1;
      });
    }, REPLAY_MS);
    return () => clearInterval(id);
  }, [playing, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      halt();
      setMoment((m) => {
        const next = Math.max(0, Math.min(last, m + (e.key === 'ArrowRight' ? 1 : -1)));
        if (next !== last) setBroke(false);
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [halt, last]);

  const active = nav.find((n) => n.id === section) ?? nav[0];
  const blocks = stage.sections[section] ?? [];
  const swapKey = `${moment}-${broke ? 'd' : 'n'}-${section}`;

  return (
    <SidebarProvider
      className="h-svh min-h-0"
      style={{ ['--sidebar-width' as string]: '248px' }}
    >
      <Sidebar collapsible="none" className="h-full border-r">
        <SidebarHeader className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[16px] font-semibold tracking-[-.02em] text-[var(--ink)]">
              Receivables<b className="font-semibold text-[var(--accent)]">Flow</b>
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-0">
          <SidebarGroup className="gap-1.5 px-2.5 py-0">
            <SidebarGroupLabel className="eyebrow h-auto px-2.5 pb-1">Dashboard</SidebarGroupLabel>
            <SidebarMenu className="gap-px">
              {nav.map((item) => {
                const count = stage.counts?.[item.id];
                const on = item.id === section;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={on}
                      onClick={() => setSection(item.id)}
                      className="h-auto justify-between rounded-[7px] px-3 py-2 text-[15px] data-[active=true]:font-medium data-[active=true]:text-[var(--accent)]"
                    >
                      <span>{item.label}</span>
                      {count === undefined ? null : (
                        <span
                          className={`rounded-full px-[7px] py-px text-[13px] tabular-nums ${
                            on
                              ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                              : 'bg-[var(--surface-tint)] text-[var(--muted)]'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {/*
          * The account card sits in the sidebar foot rather than the top bar, so the
          * bar above the content is free to say where you are in the deal instead of
          * who you are — which is the thing that actually changes as the demo runs.
          */}
        <SidebarFooter className="mt-auto gap-3 border-t px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="size-[30px] shrink-0 rounded-full bg-[linear-gradient(135deg,var(--accent),#B15BFF)]" />
            <div className="min-w-0">
              <div className="eyebrow text-[12px]">Business profile</div>
              <div className="mt-0.5 truncate text-[14px] tabular-nums text-[var(--ink)]">{ens}</div>
            </div>
          </div>
          <div className="border-t pt-3 text-[14px] leading-normal text-[var(--muted)]">
            {account ?? (
              <>
                Signed in as
                <br />
                <span className="text-[var(--body)]">{signer}</span>
              </>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex h-full min-w-0 flex-col overflow-hidden bg-[var(--background)]">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-8">
          <div className="min-w-0 truncate text-[15px] text-[var(--muted)]">
            {brand}
            <span className="mx-2 text-[var(--muted)]">/</span>
            <strong className="font-medium text-[var(--ink)]">{active.label}</strong>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Pill>
              <span className="text-[var(--muted)]">{stage.day}</span>
              <b className="font-medium text-[var(--ink)]">{stage.label}</b>
            </Pill>
            <Pill>
              <span className="size-1.5 rounded-full bg-[var(--pos)]" />
              Hedera Testnet
            </Pill>
          </div>
        </header>

        <div className="min-w-0 flex-1 overflow-y-auto px-8 pt-8 pb-12">
          <div className="mx-auto max-w-[980px]">
            <div className="mb-6">
              <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-.02em] text-[var(--ink)]">
                {active.label}
              </h1>
              <p className="mt-1.5 max-w-[60ch] text-[16px] text-[var(--body)]">{active.sub}</p>
            </div>

            <div key={swapKey} className="swap flex min-w-0 flex-col gap-5">
              {live?.[section]}
              {blocks.map((block, i) => (
                <BlockView key={i} block={block} />
              ))}
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t bg-[var(--surface)] px-8 pt-3.5 pb-4">
          <div className="mx-auto max-w-[980px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span className="eyebrow">Demo timeline — not part of the portal</span>
              <span className="flex gap-2">
                <Control
                  onClick={() => {
                    if (playing) {
                      halt();
                      return;
                    }
                    setBroke(false);
                    setMoment(0);
                    setPlaying(true);
                  }}
                >
                  {playing ? 'Stop' : 'Replay from day 0'}
                </Control>
                <Control
                  pressed={broke}
                  onClick={() => {
                    halt();
                    setBroke((b) => !b);
                    setMoment(last);
                  }}
                >
                  Broker defaults
                </Control>
              </span>
            </div>

            <div className="rail" style={{ ['--fill' as string]: `${(moment / last) * 100}%` }}>
              {stages.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  className="stop"
                  aria-current={i === moment}
                  data-past={i < moment ? '1' : '0'}
                  onClick={() => {
                    halt();
                    goto(i);
                  }}
                >
                  <span className="eyebrow mb-0.5 block text-[11px]">{s.day}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** The brand mark: a rounded indigo tile with a hairline inset square and a live dot. */
function Mark() {
  return (
    <span className="relative flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[linear-gradient(140deg,var(--accent),#3E8BFF)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.18),var(--shadow-sm)]">
      <span className="absolute inset-[6px] rounded-[3px] border-[1.5px] border-white/85" />
      <span className="absolute size-[5px] rounded-full bg-[#B8F03C] shadow-[0_0_6px_rgba(184,240,60,.9)]" />
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--surface)] px-2.5 py-[5px] text-[15px] font-medium text-[var(--body)]">
      {children}
    </span>
  );
}

function Control({
  children, onClick, pressed,
}: {
  children: React.ReactNode; onClick: () => void; pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`cursor-pointer rounded-lg border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
        pressed
          ? 'border-[var(--neg)] bg-[var(--neg-subtle)] text-[var(--neg-ink)]'
          : 'bg-[var(--surface)] text-[var(--body)] hover:border-[var(--hairline-active)] hover:text-[var(--ink)]'
      }`}
    >
      {children}
    </button>
  );
}
