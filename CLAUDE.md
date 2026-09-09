# CLAUDE.md

Everything here is a rule, not a suggestion.

## Ship something a person can see

Before starting, answer this in one sentence:

> **What will be different on screen, and where do I click to see it?**

If you can't answer it, the issue isn't ready. Go back and add the screen.

Done means all three:

1. It renders in `apps/business`, `apps/investor`, or `apps/hq`.
2. A Playwright test in `apps/e2e` clicks to it and asserts it.
3. **You hand over the report URL.** `/playwright-e2e` serves it — `http://localhost:PORT`.

That URL is the only thing that means done. Never say an issue is finished without it; a passing
count pasted into chat is a claim, the traces are the proof — anyone can open one and watch the
click land.

Code no screen reads is unfinished, however well tested. Judges watch a demo — they never open
your test output.

Smell test: if the spec's File Tree has no `apps/` in it, stop.

How, in this repo: portals are client components, so read the chain in a server component and
pass it through the portal's `live` prop. Add `export const dynamic = 'force-dynamic'` or the
page bakes the value in at build time and stops being live.

## Response style

**EVERY response is a /tldr. No exceptions. Never ask permission to be short.**

Exact format, always:

1. One numbered line per point.
2. Maximum 5 points. Maximum 1 sentence per point.
3. If there is only one point, write one plain sentence — no list.
4. Add a final `Assumes:` line only when something load-bearing went unverified.

Banned in every response, without exception:

- Headers, sub-bullets, tables, bold section labels
- Preamble, restating the question, "great question", hedging
- Background explainers, "what X is" context, analogies
- Closing offers, next-step menus, "want me to..."

This user is a hacker mid-hackathon. Length is the failure, not the fix.
A correct answer that is long is a wrong answer. Cut it before sending.

Expand ONLY when the user types the literal word "expand" or "detail".

## Questions

Never use the AskUserQuestion selection UI. One plain-text line, then stop.
