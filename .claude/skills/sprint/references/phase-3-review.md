# Phase 3 · Code Review

**What:** Surface the diff, open the PR, wait for the automated review, triage each comment, fix what needs fixing, and hand off to the human to merge.

**Why:** Mapping each spec item to the diff makes review a checklist, not a full read. The automated review adds an independent perspective — not every comment is correct, but every comment must be explicitly dispositioned so nothing slips through unexamined.

**How:** Diff map → PR → wait for automated review → Fix/Dismiss table → human approves → implement fixes → commit → human merges on GitHub.

---

## Step 1 · Surface

**What:** Give the human everything they need to say yes or no

**Why:** A checklist is faster and more reliable than asking the human to read all the code

**How:**

**Step 1a — produce the diff map.** Before showing anything to the human, read the locked spec Action Items and run `git diff main...HEAD`. For each Action Item, locate the hunk(s) that satisfy it and assign a status:
- `✅ present` — change clearly implements the item
- `⚠️ partial` — change exists but incomplete (e.g. logic added, error message missing)
- `❌ absent` — no hunk maps to this item

Then check the inverse: any hunk not covered by an Action Item is an `⚠️ extra`.

**Step 1b — show the human:**

```
━━━ Sprint: [Issue Title] ━━━━━━━━━━━━━━━━━━━━━━━━━

Action Items → Diff
  ✅  [item title] → [file:line]
  ⚠️  [item title] → [file:line] — [what's missing]
  ❌  [item title] → not found

Extra changes (not in spec)
  ⚠️  [file:line] — [description]  ← flag for human to judge
  (none)

Action Items → Tests
  ✓  [item title] — [test name]
  ✓  [item title] — [test name]

Build
  ✓  nx test [lib]  → N passed
  ✓  nx build [lib] → exits 0
  ✓  nx lint [lib]  → clean

Changes
  [git diff --stat output]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Approve? Jump to any flagged row to read the code — full diff on request.
```

---

## Step 2 · Open PR

**What:** Create the pull request

**Why:** The PR is the permanent record of the change, linked back to the issue

**How:** 🛑 WAIT — only open the PR after the human explicitly approves in Step 1. Invoke skill `git` (`Skill(git)`) — it is the single source of truth for PR format, title rules, and scope guard. Do not write PR body inline here.

---

## Step 3 · Wait for automated review

**What:** Wait for the GitHub Actions Claude reviewer to finish and fetch its comments

**Why:** The automated reviewer acts as an independent senior/security engineer with no context of the decisions made — every comment must be explicitly dispositioned before merging

**How:**

```bash
gh pr checks [PR#] --watch
```

Wait until all checks complete. Then fetch the review comments:

```bash
gh pr view [PR#] --comments
```

---

## Step 4 · Triage review comments

**What:** Reason through each comment and produce a Fix/Dismiss table

**Why:** Not every automated comment is correct — the reviewer lacks full context of design decisions. The discipline is that every comment must be explicitly addressed: either fixed or dismissed with a stated reason. Silence is not a disposition.

**How:** For each comment, reason independently:
- Does it point to a real bug or security issue? → **Fix**
- Does it conflict with a documented design decision in the spec? → **Dismiss** (cite the spec)
- Is it a style preference that doesn't affect correctness? → **Dismiss** (state why)
- Is it a valid improvement outside the spec's scope? → **Dismiss** (note as future issue if worth tracking)

Show the triage table:

```
━━━ Automated Review: [PR#] ━━━━━━━━━━━━━━━━━━━━━━━

Comment                          | Disposition
─────────────────────────────────|──────────────────────────────────
[short description of comment]   | Fix — [what will change]
[short description of comment]   | Dismiss — [reason]
[short description of comment]   | Dismiss — [spec decision it conflicts with]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

🛑 WAIT — show the triage table and wait for the human to approve the fix plan before implementing anything.

---

## Step 5 · Implement fixes

**What:** Apply the fixes the human approved

**Why:** Fixes go on the same branch so the PR diff stays complete

**How:** Implement each Fix item. Run tests and build after each fix. Commit using the git skill commit format. Skip if there are no fixes.

---

## Step 6 · Post triage record as PR comment

**What:** Post a comment on the PR documenting the Fix/Dismiss rationale for every automated review comment

**Why:** The triage decisions are permanent engineering judgements — not just a handshake between Claude and the human during the sprint. The PR comment makes the rationale visible to anyone reading the PR history later, without needing to reconstruct the reasoning.

**How:** After all fixes are implemented and committed (or confirmed none required), post a comment on the PR:

```bash
gh pr comment [PR#] --body "$(cat <<'EOF'
## Automated Review Triage

| Comment | Disposition | Reason |
|---------|-------------|--------|
| [short description of comment] | Fix | [what was changed] |
| [short description of comment] | Dismiss | [reason — spec decision, style preference, or out of scope] |
EOF
)"
```

Post this before handing off to the human to merge. Always post it, even if every comment was dismissed.

---

## Step 7 · Wait for human to merge

🛑 WAIT — the human merges manually on GitHub. Never run `gh pr merge`. After the human confirms the PR is merged, proceed to Step 8.

---

## Step 8 · Mark Done

**What:** Close the issue in Linear

**Why:** The spec was a planning tool — once the code ships, the code and tests are the permanent record

**How:** Invoke skill `linear-issue` (`Skill(linear-issue, "done")`):
- Mark issue Done
- Add comment: `Verified. PR: [url]. Spec: [path]`

Then ask: "Next issue from backlog, or new intent?"

---

## If the human rejects the diff (Step 1)

Don't re-open Phase 1. Ask what looks wrong, go back to Phase 2 to fix the implementation. Phase 1 only re-opens if the spec itself needs changing — that is a new sprint, not an automatic loop.

---

## Exit condition

| | |
|---|---|
| Human | approved diff in Step 1 |
| PR | opened and all checks complete |
| Automated review | every comment has Fix or Dismiss disposition, human approved |
| Fixes | implemented and committed (or none required) |
| Triage record | PR comment posted with Fix/Dismiss rationale for every comment |
| Merge | human merged on GitHub |
| Linear | marked Done with PR url |
| Spec + Test Plan | issue directory deleted from `specs/` |
