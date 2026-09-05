# Phase 2 · Build

**What:** Write tests first, implement until they pass, then commit.

> **Scope constraint:** You may only create or modify files whose paths are directly implied by the spec's Action Items. `.claude/` skill files, other apps' source, other sprints' specs or tests, and shared infrastructure not listed in the Action Items are read-only. Before writing any file, ask: "Is this file named or implied by a spec Action Item?" If no → do not touch it.

**Why:** Writing tests before code forces the implementation to match the spec, not the other way around.

**How:** One human check at the start (approve the test plan); everything else runs automatically from there.

---

## Step 1 · Derive Test Plan

**What:** Produce a Test Plan that maps every spec statement to a named test case before touching any code

**Why:** Tests written after code check what the code does, not what you intended

**How:** Invoke the `tests` skill (`Skill(tests)`). Derive directly from `## Action Items` and `## Core Logic` — do not look at existing code first. The tests skill loads `references/plan.md`, derives the Test Plan, writes it to `specs/<project>/<milestone>/<issue-id-slug>/test.md`, and prints it in the standard format.

---

## Step 2 · Human approves Test Plan

**What:** Human confirms the Test Plan covers the right spec items with the right assertions

**Why:** A test that passes but checks the wrong thing is worse than no test

**How:** 🛑 WAIT — the `tests` skill surfaces the Test Plan from `test.md`. Do not write any test code until the human explicitly approves. If the human rejects, update `test.md` per the feedback and surface again. Repeat until approved.

---

## Step 3 · Write tests (Red)

**What:** Write all test code from the approved plan, confirm every test fails

**Why:** A test that passes before implementation either tests nothing or is asserting the wrong thing

**How:** The `tests` skill writes the test files per the layer reference. Once written, run the suite and confirm all new tests fail:

```
nx test <lib>     → new tests fail, no pre-existing tests broken
```

If any new test passes before implementation: stop, the test is asserting the wrong thing — fix it before proceeding.

---

## Step 4 · Implement (Green)

**What:** Write the minimum implementation to make all failing tests pass

**Why:** The tests encode the spec — the only job here is to make them green

**How:** Implement to make the tests pass. Stay strictly within the spec. Do not write code not required by a failing test.

```
nx test <lib>                                          → all tests pass
nx build <lib>                                         → exits 0
nx lint <lib>                                          → clean
pnpm exec tsc --noEmit -p <lib-path>/tsconfig.json    → zero errors
```

---

## Step 5 · Refactor

**What:** Clean up the implementation without changing behaviour

**Why:** Green tests prove correctness; refactor improves clarity without risking regression

**How:** Improve naming, remove duplication, simplify logic. Re-run the suite after every change — if a test goes red, the refactor changed behaviour, revert it.

```
nx test <lib>     → still all green
```

Self-check before surfacing to Phase 3:

| Action Item | Test | Result |
|---|---|---|
| [item title] | [test name] | ✓ |

Do not enter Phase 3 with any Action Item unmapped to a passing test.

Once all tests pass, mark every Action Item in `spec.md` from `[ ]` to `[x]`. The spec is a permanent record — the checkboxes confirm what was built and verified, not a live progress tracker.

---

## Step 6 · Final commit

**What:** Commit any remaining changes and hand off to Phase 3

**Why:** Every commit must carry the Linear ID so commits, PRs, and issues stay linked

**How:** Invoke skill `git` (`Skill(git)`) for any remaining staged changes. Commit message footer must include the Linear issue ID. Then surface to Phase 3 automatically — no human input needed.

---

## Exit condition

| | |
|---|---|
| Tests | derived from Action Items, human-approved, before any implementation |
| `nx test` | passes with zero failures |
| `nx build` + `nx lint` | clean |
| `pnpm exec tsc --noEmit -p <lib>/tsconfig.json` | zero errors |
| Self-check table | every Action Item maps to a passing test |
| `spec.md` Action Items | all marked `[x]` |
| Commits | one or more, all with Linear issue ID in footer |
