'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Sidebar, SidebarContent, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
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
  nav: NavItem[];
  stages: Stage[];
  defaulted: Stage;
  /** Which moment the portal opens on — the deal is most legible mid-flight. */
  openAt?: number;
}

export function Portal({ brand, ens, signer, account, nav, stages, defaulted, openAt = 3 }: PortalProps) {
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
    <div className="flex h-svh min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-6 border-b bg-[var(--surface)] px-[26px] py-[13px]">
        <div className="min-w-0">
          <div className="font-heading text-[10.5px] font-bold tracking-[.16em] uppercase text-[var(--muted-ink)]">
            Receivables <span className="text-[var(--brand)]">Flow</span>
          </div>
          <div className="mt-[5px] flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-heading text-[17px] font-semibold tracking-[-.012em] text-[var(--ink)]">
              {brand}
            </h1>
            <span className="font-mono text-[10.5px] break-all text-[var(--muted-ink)]">{ens}</span>
          </div>
        </div>

        <div className="shrink-0 text-right text-[11px] leading-normal text-[var(--muted-ink)]">
          {account ?? (
            <>
              Signed in as
              <br />
              <span className="font-mono text-[10.5px] text-[var(--ink-2)]">{signer}</span>
            </>
          )}
        </div>
      </header>

      <SidebarProvider className="min-h-0 flex-1">
      <Sidebar collapsible="none" className="h-full border-r">
        <SidebarContent className="px-[10px] py-3">
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={item.id === section}
                  onClick={() => setSection(item.id)}
                  className="justify-between rounded-[2px] text-[13.5px]"
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[10.5px] tabular-nums">
                    {stage.counts?.[item.id] ?? ''}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

      </Sidebar>

      <SidebarInset className="flex h-full min-w-0 flex-col overflow-hidden bg-[var(--ground)]">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-[18px] border-b bg-[var(--surface)] px-[26px] py-[17px]">
          <div>
            <h2 className="font-heading text-[20px] font-semibold tracking-[-.015em] text-[var(--ink)]">
              {active.label}
            </h2>
            <div className="mt-[2px] text-[12.5px] text-[var(--muted-ink)]">{active.sub}</div>
          </div>
          <div className="text-right font-mono text-[11px] leading-normal tabular-nums text-[var(--muted-ink)]">
            <b className="font-medium text-[var(--ink-2)]">{stage.day}</b> · {stage.label}
          </div>
        </header>

        <div key={swapKey} className="swap flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-[26px] pt-[22px] pb-[30px]">
          {blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </div>

        <footer className="shrink-0 border-t bg-[var(--surface)] px-[26px] pt-[14px] pb-4">
          <div className="eyebrow mb-[11px] flex flex-wrap justify-between gap-3">
            <span>Demo timeline — not part of the portal</span>
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
                <span className="mb-[2px] block text-[9px] tracking-[.11em] uppercase">{s.day}</span>
                {s.label}
              </button>
            ))}
          </div>
        </footer>
      </SidebarInset>
      </SidebarProvider>
    </div>
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
      className={`cursor-pointer rounded-[2px] border px-[11px] py-[6px] font-mono text-[10px] tracking-[.07em] uppercase transition-colors ${
        pressed
          ? 'border-[var(--neg)] bg-[var(--neg-soft)] text-[var(--neg)]'
          : 'bg-[var(--surface-2)] text-[var(--ink-2)] hover:border-[var(--brand-line)] hover:text-[var(--ink)]'
      }`}
    >
      {children}
    </button>
  );
}
