---
version: 1
name: Receivables Flow — Investor
description: "Woodgrove Capital's side of the market. The shared Receivables Flow system with one substitution: the accent is blue #2563EB, not indigo. Everything else — ink, surfaces, hairlines, state colours, type, spacing, components — is docs/design.md unchanged."
implementation: apps/investor/src/app/globals.css
extends: docs/design.md
colors:
  accent: "#2563EB"
  accent-strong: "#1D4ED8"
  accent-subtle: "rgba(37,99,235,.08)"
  accent-surface: "rgba(37,99,235,.05)"
  accent-dark: "#6BA6FF"
  accent-strong-dark: "#93BFFF"
mark:
  logo: /receivables-flow-logo.svg
  account-chip: { emoji: "💰", fill: "#DCE8FF", text: "#1D4ED8" }
---

# Receivables Flow — Investor

## Why this file exists

The two portals ran the same indigo and were indistinguishable in a screenshot. A demo that
cuts between three tabs of the same product needs a viewer to know which side of the trade
they are looking at before they read a word, and colour is the only thing that works at the
speed of a cut.

Blue is the buyer's side. It is the register a fund's own screens are already in — capital,
custody, mandate — and it sits far enough from the seller's orange to survive a compressed
video frame.

## What changes

Only the accent, in all three places it is defined — light, `prefers-color-scheme: dark`, and
the forced `.dark` class:

| Token | Light | Dark |
|---|---|---|
| `--accent` | `#2563EB` | `#6BA6FF` |
| `--accent-strong` | `#1D4ED8` | `#93BFFF` |
| `--accent-subtle` | `rgba(37,99,235,.08)` | `rgba(107,166,255,.14)` |
| `--accent-surface` | `rgba(37,99,235,.05)` | `rgba(107,166,255,.07)` |

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
moneybag on a cool fill, followed by `woodgrove.investor.receivablesflow.eth`.
