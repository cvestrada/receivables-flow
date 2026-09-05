# PR Creation

**What:** Open a pull request with a clear description, linked to the Linear issue.

**Why:** A small, well-described PR is faster to review — the reviewer knows what to expect before reading the code.

**How:** Check the diff stays within the size limit, push the branch, and open the PR with the Linear ID in the body.

---

## Step 1 · Scope guard (≤10 min review)

Before pushing, verify the diff fits within a 10-minute human review window.

```bash
git diff main...HEAD --stat
```

**Hard limits — if any are exceeded, split the branch first:**

| Signal | Limit |
|---|---|
| Meaningful LOC changed | ≤ 200 |
| Files touched | ≤ 10 |
| Logical changes (spec items, bug fixes) | = 1 |

Excluded from the count: lockfiles (`pnpm-lock.yaml`), type-generated files (`*.kysely.ts`, `*.kanel.ts`), SQL migration files with no branching logic, and Terraform plan output.

**Split rule:** If the diff spans two independent domains (e.g., auth + invoicing), or implements more than one Action Item from the spec, stop — split into one branch per logical change before proceeding.

---

## Step 2 · Push the branch

```bash
git push -u origin [branch-name]
```

---

## Step 3 · Open the PR

```bash
gh pr create --title "Short plain English title" --body "$(cat <<'EOF'
## What
[copied verbatim from spec Overview · What]

## Why
[copied verbatim from spec Overview · Why]

## How
[copied verbatim from spec Overview · How]

## Verification
[one entry per Action Item — the verify command followed by its actual output:
- `pnpm nx build business-fe` — exits 0
- `pnpm nx show projects | grep -w business-fe` — exits 0, printed `business-fe`]
EOF
)"
```

Rules:
- One PR per branch — one or more commits within it
- Title is plain English — no type prefix, no jargon
- What / Why / How are copied verbatim from the spec Overview — no rewriting
- Verification is one bullet per spec Action Item: the verify command + its actual result when run. Never copy What/Why/How content here.
- No Linear issue ID footer — the linear-code bot links automatically from the branch name
- No Claude Code attribution footer

---

---

## Hard Rule · Never merge via CLI

**Never run `gh pr merge` or any equivalent CLI merge command.** The human always merges manually on GitHub.

**Why:** Merging is irreversible and affects main. The human needs to be the one who pulls the trigger — after the automated review is triaged and fixes are committed.

---

## Exit Condition

`gh pr view` returns the PR URL and shows the correct title, body, and linked issue. Diff is within the Step 1 limits. Human merges manually on GitHub.
