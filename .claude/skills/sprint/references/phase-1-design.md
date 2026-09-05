# Phase 1 · Design

**What:** Turn a rough idea into an approved spec and a Linear issue.

**Why:** Writing the plan down before building keeps it from changing halfway through.

**How:** AI asks the hard questions and suggests answers; the human only fills in what AI can't resolve. One "yes" ends the phase.

---

## Step 1 · First Principles

**What:** Strip beliefs, surface facts, then build the approach from those facts only

**Why:** Vague intent produces a spec you can't verify later; borrowed assumptions bake in the same constraints that caused the problem

**How:** Invoke `first-principles` (`Skill(first-principles)`). Sprint-specific targets:

1. **How** — approach, data flow, key interfaces
2. **Constraints** — what must always be true, what must never happen
3. **Dependencies** — what must exist first (→ `Blocked by` in Linear)
4. **Verification criteria** — runnable command, deterministic binary result

---

## Step 2 · PR size check

**What:** Confirm the work fits in a ≤10-minute review

**Why:** Larger diffs hide mistakes and slow down review

**How:** After extracting all Action Items, ask: can a senior engineer review the resulting PR in under 10 minutes?

- **Yes** → proceed to Step 02
- **No** → split into smaller issues, grill each one separately, then proceed

---

## Step 3 · Draft Spec

**What:** Turn the grilling output into a draft spec with raw Action Items

**Why:** A written plan surfaces everything that needs to be built before any of it gets built

**How:** Invoke the `spec` skill (`Skill(spec)`). Output: `specs/<project>/<milestone>/<section>/<TECH-N-name-slug>.md` — where `TECH-N` is the Linear issue ID and `name-slug` is the issue title in kebab-case. Produce Core Logic and a raw Action Items list. Do not seek approval yet — the next step prunes first.

---

## Step 4 · Prune Action Items — Delete Algorithm Steps 1–3

**What:** Strip every Action Item that does not need to exist before locking the spec

**Why:** Specs carry more Action Items than required by default — attaching names to requirements and challenging each one removes waste before it becomes code

**How:** Run the three steps in order on the drafted Action Items list:

1. **Make Requirements Less Dumb** — for each Action Item, name the specific human who required it. No item survives as "we need this" or "best practice says". If an owner cannot be named, flag it for deletion.

2. **Delete** — for each item, ask: "What breaks if this is removed?" Cut anything that cannot be concretely answered. Log every cut with a stated reason. If nothing is cut, flag it explicitly — the list is not being challenged aggressively enough.

3. **Simplify** — for each surviving item, ask: "Can this be done in fewer steps or fewer files?" Merge or reduce where possible.

Update the spec draft with the pruned Action Items list before moving to approval.

---

## Step 5 · Spec Approval

**What:** Human reads and explicitly signs off on the pruned spec

**Why:** This is the last chance to correct the plan before it is locked

**How:** 🛑 WAIT — do not proceed until the human explicitly approves the spec.

---

## Step 7 · Create Linear Issue

**What:** Create the issue in Linear and check out a branch

**Why:** The issue ID ties every commit and PR back to this piece of work

**How:** Invoke the `linear-issue` skill (`Skill(linear-issue, "create")`). Include:
- Title matching the spec H1 exactly — the spec filename slug is derived from this title (`TECH-N-[title-slug].md`, lowercase hyphenated)
- `Spec: specs/...` line pointing to the file
- `Blocked by: [issue]` if applicable

Show the created issue ID, then run `git worktree add /home/orbbit/receivables-flow-worktrees/TECH-N-slug -b tech-n-slug` from `/home/orbbit/receivables-flow/`.

---

## Exit condition

| | |
|---|---|
| Spec | exists at `specs/<project>/<milestone>/<section>/<TECH-N-name-slug>.md`, Core Logic non-placeholder, human-approved |
| Action Items | every verify clause is a runnable command with deterministic output |
| Linear issue | created with `Spec:` line |
