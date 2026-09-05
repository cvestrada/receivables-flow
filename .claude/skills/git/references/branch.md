# Branch Naming

**What:** Create a branch named after the Linear issue, and a worktree directory with a matching uppercase name.

**Why:** The naming format links the branch to Linear automatically. The uppercase worktree directory name makes it easy to distinguish worktrees from regular directories at a glance and keeps them consistent with each other.

**How:** Take the Linear ID, add a short 3–5 word description in kebab-case for the branch; use the same slug but with the Linear ID in uppercase for the worktree directory.

---

## Step 1 · Choose the branch name

Branch format: `[linear-id]-[kebab-case-description]` — all lowercase

- `linear-id` is the issue identifier in lowercase, e.g. `tech-15`
- Keep description 3–5 words max
- Linear auto-links the branch to the issue — no manual config needed

Examples: `tech-15-migrate-business-frontend-to-vite`, `tech-14-business-bff-shell`

---

## Step 2 · Create the worktree

Worktree directory format: `TECH-N-[kebab-case-description]` — LINEAR-ID in uppercase, same slug as the branch

```bash
git worktree add /home/orbbit/receivables-flow-worktrees/TECH-N-short-description [branch-name]
```

- Worktree directory uses uppercase `TECH-N`, e.g. `TECH-15-migrate-business-frontend-to-vite`
- Branch inside uses lowercase, e.g. `tech-15-migrate-business-frontend-to-vite`
- All worktrees live under `/home/orbbit/receivables-flow-worktrees/`

Example:
```bash
git worktree add /home/orbbit/receivables-flow-worktrees/TECH-15-migrate-business-frontend-to-vite tech-15-migrate-business-frontend-to-vite
```

---

## Step 3 · Verify

```bash
git worktree list
```

→ shows `TECH-N-slug` directory pointing to the correct branch

---

## Exit Condition

Branch exists locally: `git branch --list [linear-id]-*` returns the branch name.
