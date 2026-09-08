---
version: 2
name: Receivables Flow
description: "The Receivables Flow design system. Indigo #635BFF on white and #F8FAFD, navy ink, one variable typeface (Inter Tight) covering both the sans and mono role with tabular figures, 8/12px radii, pill badges, and a fixed sidebar under a 56px breadcrumb topbar."
implementation: apps/{business,investor}/src/app/globals.css
colors:
  accent: "#635BFF"
  accent-strong: "#533AFD"
  accent-subtle: "rgba(99,91,255,.08)"
  ink: "#0A2540"
  ink-deep: "#061B31"
  body: "#3C4F69"
  muted: "#64748D"
  surface: "#FFFFFF"
  surface-alt: "#F8FAFD"
  surface-tint: "#E5EDF5"
  hairline: "#E5EDF5"
  hairline-active: "#D3E0EC"
  pos: "#1B9C68"
  pos-ink: "#11734B"
  warn: "#C8871B"
  neg: "#D2483A"
  neg-ink: "#A4342A"
typography:
  family: Inter Tight (variable) — sans and mono role both
  page-title: { fontSize: 28px, fontWeight: 600, letterSpacing: -0.02em, lineHeight: 1.1 }
  page-sub: { fontSize: 16px, color: "{colors.body}", maxWidth: 60ch }
  section-title: { fontSize: 16px, fontWeight: 600, color: "{colors.ink}" }
  figure: { fontSize: 26px, fontWeight: 600, letterSpacing: -0.01em, numeric: tabular-nums }
  eyebrow: { fontSize: 13px, fontWeight: 500, letterSpacing: 0.1em, textTransform: uppercase, color: "{colors.muted}" }
  body: { fontSize: 15px, lineHeight: 1.55, color: "{colors.body}" }
  table-head: { fontSize: 13px, fontWeight: 500, letterSpacing: 0.08em, textTransform: uppercase }
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  nav: 7px
  pill: 999px
shadow:
  sm: "0 1px 3px rgba(10,37,64,.04)"
  md: "0 1px 3px rgba(10,37,64,.04), 0 8px 32px rgba(10,37,64,.06)"
  float: "rgba(50,50,93,.25) 0 30px 60px -12px, rgba(0,0,0,.3) 0 18px 36px -18px"
components:
  sidebar: { width: 248px, background: "{colors.surface-alt}", borderRight: "1px {colors.hairline}" }
  topbar: { height: 56px, paddingX: 32px, borderBottom: "1px {colors.hairline}" }
  content: { paddingX: 32px, paddingTop: 32px, maxWidth: 980px }
  panel: { background: "{colors.surface}", border: "1px {colors.hairline}", rounded: "{rounded.lg}", shadow: "{shadow.sm}" }
  stat: { same as panel, padding: "16px 18px", label: "{typography.eyebrow}", value: "{typography.figure}" }
  badge: { rounded: "{rounded.pill}", padding: "4px 10px", fill: "<state>-subtle", text: "<state>-ink", leadingDot: true }
  button-primary: { background: "{colors.accent}", text: "#FFFFFF", rounded: "{rounded.md}", padding: "10px 18px" }
---

# Receivables Flow

## Overview

A receivables desk for two audiences who are on opposite sides of the same trade: a business selling an unpaid invoice, and a funder buying it. The visual job is credibility under density — a screen of money that a credit officer trusts — without the terminal-green severity that would make an SME bounce off it.

Indigo is the only saturated hue in the chrome. Everything else is navy ink, slate, and hairline grey, with three state colours doing the rest: green settled, red failed, amber pending. Structure comes from a 1px hairline plus a nearly invisible contact shadow — never from a heavy drop shadow.

**Key characteristics:**
- One variable typeface, Inter Tight, doing both the sans and the mono job — `tabular-nums` handles the column alignment a second monospaced family would otherwise be carried for.
- 12px radius on panels and stat cards, 8px on buttons and inputs, 7px on nav items, fully pill on badges.
- Uppercase is rationed to exactly three places: the sidebar section label, a stat caption, and a table column header. Panel headings are sentence case at 16px/600.
- A number outranks every heading around it — figures are weight 600 at 26px while body text sits at 400–500.
- Two shadow scales: the quiet one for every dashboard surface, `--shadow-float` for modals and hero surfaces only.

## Layout

```
┌────────────┬──────────────────────────────────────────┐
│  sidebar   │  topbar 56px — breadcrumb · status pills  │
│  248px     ├──────────────────────────────────────────┤
│            │                                          │
│  mark +    │   page title 28px                        │
│  wordmark  │   page sub 16px                          │
│            │                                          │
│  DASHBOARD │   ┌──────┐┌──────┐┌──────┐┌──────┐       │
│  · nav     │   │ stat ││ stat ││ stat ││ stat │       │
│  · nav  5  │   └──────┘└──────┘└──────┘└──────┘       │
│            │                                          │
│            │   ┌────────────────────────────────┐     │
│            │   │ panel                          │     │
│  ─────     │   └────────────────────────────────┘     │
│  account   │                            max-w 980px   │
└────────────┴──────────────────────────────────────────┘
```

The account lives in the sidebar foot, not the topbar — which frees the bar above the content to say *where you are in the deal* (day, stage, network) rather than who you are.

## Components

**`.desk`** — the workhorse surface. White fill, 1px hairline, 12px radius, `--shadow-sm`. Panels and stat cards are both this.

**Panel** — `.desk` with a header row (16px/600 sentence-case heading, optional status badge right, 1px bottom rule), content flush to the border with per-cell padding, and an optional note band on `--surface-alt`.

**Stat card** — separate `.desk` cards on `grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4`. Uppercase eyebrow caption, 26px figure, optional 15px footnote. Never one panel subdivided by rules.

**`.st` badge** — fully pill, tinted `-subtle` fill, `-ink` text, no border, with a 5px leading dot in `currentColor` so state does not rest on hue alone. Four tones: `ok`, `bad`, `hot` (indigo — live/in-flight), `idle`.

**Table** — header row on `--surface-alt` in uppercase 13px/0.08em; body rows `12px 20px`, `tabular-nums`, hover to `--surface-alt`.

**Nav item** — 7px radius, 15px, `--body` ink; active is indigo text on `--accent-subtle` at weight 500, with the count badge inheriting the same pair.

**`.rail`** — the demo timeline: a 2px track filling indigo, 14px stops that fill when passed and gain a 4px `--accent-subtle` ring when current.

## Do's and Don'ts

### Do
- Put every number in `tabular-nums` — it is the whole reason one typeface can serve both roles.
- Reserve indigo for interaction and live state; green is settled, red is failed, grey is idle.
- Keep uppercase to the three places named above.
- Give every state badge its leading dot.
- Write both light and dark values when adding a token.

### Don't
- Don't use `--shadow-float` on a dashboard panel — it is for modals and hero surfaces.
- Don't add a second typeface, including a monospace one.
- Don't put stat captions in sentence case or panel headings in uppercase.
- Don't introduce a hue outside indigo plus the three state colours.
- Don't hardcode a hex in a component; every colour resolves through `globals.css`.

## Iteration Guide

1. **Tokens live in `apps/business/src/app/globals.css`**, and the investor app's copy is byte-identical. Change one, copy to the other.
2. **shadcn is the component layer** — `src/components/ui/` holds sidebar, table, card, badge, dropdown, sheet, tooltip. Every shadcn semantic token is repointed at the palette above, so installed components inherit the system without per-component overrides.
3. **Portal furniture shadcn doesn't cover** (`.desk`, `.eyebrow`, `.figure`, `.st`, `.feed-row`, `.rail`) lives at the bottom of `globals.css` as plain classes. Add there, not in component files.
4. **Blocks are declarative.** `blocks.tsx` renders `Block` objects from `src/data/*.data.ts`; add a block type rather than hand-rolling markup in a page.
5. **New status?** Extend the four badge tones rather than adding a fifth colour.

## Known Gaps

- Form surfaces (input, select, validation) are shadcn stock and have not been tuned to this scale.
- Focus states are defined for the timeline stop only; everything else rides the shadcn `--ring`.
- No chart system. When one is needed, derive series colours from indigo plus the three state tones — do not add a categorical palette.
- Empty, loading, and error states are unspecified beyond `Skeleton` and the `empty` block.
- The sidebar's mobile sheet is shadcn stock; the 248px fixed rail has not been responsive-tested below tablet.

---

*Prior art the palette and shell were calibrated against is kept locally under `docs/references/`, which `.gitignore` excludes. It was never the spec — this file is.*
