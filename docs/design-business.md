---
version: 1
name: Receivables Flow — Business
description: "Ironline Freight's side of the market. The shared Receivables Flow system with one substitution: the accent is orange #D9641E, not indigo. Everything else — ink, surfaces, hairlines, state colours, type, spacing, components — is docs/design.md unchanged."
implementation: apps/business/src/app/globals.css
extends: docs/design.md
colors:
  accent: "#D9641E"
  accent-strong: "#B24D14"
  accent-subtle: "rgba(217,100,30,.08)"
  accent-surface: "rgba(217,100,30,.05)"
  accent-dark: "#F0873F"
  accent-strong-dark: "#F5A469"
mark:
  logo: /receivables-flow-logo.svg
  account-chip: { emoji: "💼", fill: "#FBE6D3", text: "#8A3E0B" }
---

# Receivables Flow — Business

## Why this file exists

The two portals ran the same indigo and were indistinguishable in a screenshot. A demo that
cuts between three tabs of the same product needs a viewer to know which side of the trade
they are looking at before they read a word, and colour is the only thing that works at the
speed of a cut.

Orange is the seller's side. It reads as urgency and cash flow rather than as capital, which
is the right register for a company whose payroll runs in eleven days.

## What changes

Only the accent, in all three places it is defined — light, `prefers-color-scheme: dark`, and
the forced `.dark` class:

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#D9641E` | `#F0873F` |
| `--accent-strong` | `#B24D14` | `#F5A469` |
| `--accent-subtle` | `rgba(217,100,30,.08)` | `rgba(240,135,63,.14)` |
| `--accent-surface` | `rgba(217,100,30,.05)` | `rgba(240,135,63,.07)` |

That carries the sidebar's active row, the primary button, the focus ring, the brand word and
every `--accent` reference in the portal, because nothing in this codebase writes a hue
literal — it all reads the token.

## What does not change

Ink, body, muted, surfaces, hairlines, radii, shadows, type scale and every component spec are
`docs/design.md` verbatim. Green still means settled, red failed, amber pending on both sides:
a state colour that meant different things in two tabs of one product would be worse than no
colour at all.

## The mark

The sidebar carries the product logo, `/receivables-flow-logo.svg`, the same file on both
sides — the product is one product. The differentiator is the account chip on the topbar: a
briefcase on a warm fill, followed by `ironline.business.receivablesflow.eth`.
