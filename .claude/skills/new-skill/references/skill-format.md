# How to Write a Skill File

**What:** Write a valid SKILL.md file step by step.

**Why:** A consistent format means skills load and fire correctly every time.

**How:** Create the folder, write the frontmatter and header, add the SOP diagram, Structured Output block, Hard Rules, and a References table if needed — in that order.

---

## Step 1 · Create the directory structure

```
.claude/skills/<name>/
    SKILL.md
    references/          ← only if the skill routes to multi-step reference procedures
        <procedure>.md
```

Use kebab-case for the directory name. The name must match the frontmatter `name:` field exactly.

---

## Step 2 · Write the frontmatter

```
---
name: <kebab-case-name>
description: <one sentence — what triggers this skill. Start with the user action: "Use when the user says X, asks about Y, or wants to Z.">
---
```

The `description` field is what the AI reads to decide whether to invoke this skill. Make it specific enough that it does not fire on the wrong intent.

---

## Step 3 · Write the header

```
# /<name> — <short title>

**What:** One sentence. What does this skill do? Plain English.

**Why:** One sentence. Why does this need to be a skill — what failure does it prevent?

**How:** Two to four sentences. High-level approach: what happens when this skill runs? No step-by-step detail here — that goes in the SOP or references.
```

---

## Step 4 · Write the SOP

````
## SOP

```mermaid
flowchart TD
    [capture the essence of the skill logic as a concise flowchart]
    [show human approval gates as 🛑 WAIT nodes]
    [show decisions as diamond shapes {}]
```
````

Rules:
- Never use `\n` inside node labels
- Every human approval gate is a 🛑 node
- Every decision branch is a diamond `{}`
- Keep node labels to one clause — no full sentences

---

## Step 5 · Write the Structured Output block

````
## Structured Output: <Name>

Print at the top of every response without exception:

```
▶ /<name> · [step or phase]
  [field]:  [value or "unknown"]
  [field]:  [value or "unknown"]
  Status:   [current status]
```
````

Rules:
- The block is the first thing in every response, always
- Field names are fixed — never change them mid-skill
- Values update as state changes; labels never do
- Every skill has this section, even single-turn ones — for single-turn skills, Status is either "in progress" or "done"

---

## Step 6 · Write the Hard Rules

```
## Hard Rules

**<Rule name>**
One rule per heading. Binary constraint — what must always be true, or must never be true.
```

Minimum one rule. If you find yourself writing "try to" or "usually", it is not a hard rule — rewrite it until it is binary or remove it.

---

## Step 7 · Write the References table if have one

```
## References

| Description | File |
|---|---|
| <what this file contains> | `references/<name>.md` |
```
