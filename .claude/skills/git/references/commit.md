# Commits

**What:** Commit changes in small, focused groups with a clear message.

**Why:** Small commits are easier to review. Linear auto-links via the branch name; the PR carries the issue reference.

**How:** Check what changed, stage one logical chunk at a time, write a What/Why/How message with the Linear ID, and repeat until everything is committed.

---

## Step 1 · Inspect changes

```bash
git status --porcelain
git diff
git diff --staged
git log --oneline -10
```

---

## Step 2 · Stage one logical group

```bash
git add path/to/file1 path/to/file2
```

- One logical change per commit — test files go with the code they test
- Keep each commit to a small, focused delta. The goal: a reviewer can read the full PR diff in under 10 minutes. Auto-generated files (generated types, migrations, lock files) are excluded from that estimate — only logic changes count.
- **Minimize verification cost per commit.** Each commit should be understandable on its own — if a reviewer must read another commit to verify this one, split it.
- Never commit secrets (.env, credentials, private keys)

---

## Step 3 · Write the commit

Format:

```
<type>: <description>

Co-Authored-By: Claude Sonnet 4.6
```

```bash
git commit -m "$(cat <<'EOF'
feat: description

Co-Authored-By: Claude Sonnet 4.6
EOF
)"
```

Commit type reference:

| Type | Purpose |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code refactor (no feature/fix) |
| `test` | Add/update tests |
| `chore` | Maintenance/misc |
| `infra` | Infrastructure/config wiring |

Rules:
- Present tense, imperative mood: "add" not "added"
- Description under 72 characters
- No body required

---

## Step 4 · Repeat for remaining logical groups

Return to Step 1 until all changes are committed.

---

## Step 5 · Push (only when asked)

**Never push automatically after committing.**

- If no PR is open yet: push is part of the PR creation step — do not push here.
- If a PR is already open: stop after the commit, report the commit hash, and ask the user before pushing. Pushing to a branch with an open PR triggers CI and a cloud code review immediately — the human must decide when they are ready.

Only run `git push` when the user explicitly says to push.

---

## Exit Condition

`git status` is clean and `git log --oneline -1` shows the new commit with the correct format.
