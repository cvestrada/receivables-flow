# SOP Skill Procedure

**What:** Design and write a skill that runs in multiple ordered steps.

**Why:** Multi-step processes break silently without a clear check for when each step is done.

**How:** List each step and what it produces, define a simple yes/no check for each transition, get human sign-off on the structure, then write the file.

---

## Step 1 · Map the steps

Ask: "What does this process start with, and what does it end with?"

Then: "What are the intermediate states — what exists at each point that did not exist before?"

Do not proceed until every step has a named artifact. A step without a named artifact cannot be gated.

Record as: `STEPS` — ordered list of step name → artifact produced

---

## Step 2 · Define exit conditions

For each step in `STEPS`, ask: "How would I know this step was completed correctly?"

The answer must be binary (pass/fail). If the answer uses "mostly", "approximately", or "seems", push back: "What single fact confirms this step is done — yes or no?"

Record as: `EXIT_CONDITIONS` — one per step

---

## Step 3 · Define gate owners

For each step transition, write:

```
Before [next step]: [one checkable fact]
Confirmed by: [human | automated | both]
```

If a gate cannot be confirmed without starting the next step, go back to Step 2 and find a cheaper verification method.

Record as: `GATES`

---

## Step 4 · Identify hard rules

Ask: "What could silently produce a bad artifact without triggering any gate?"

Ask: "What ordering does this process depend on — what breaks if steps run out of order?"

Ask: "What is the minimum valid version of this process — what cannot be omitted?"

Each answer is a candidate hard rule. Keep only binary ones.

Record as: `HARD_RULES`

---

## Step 5 · Get approval on the structure

Present the full list: steps → artifacts → exit conditions → gates → hard rules.

🛑 WAIT — do not write any files until the human explicitly approves this structure.

---

## Step 6 · Decide the file structure

Ask: does ownership change between any two steps — or is there a hard human-approval gate between them?

- **Yes** → group those steps into a named phase. Each phase gets its own reference file.
- **No** → steps are inline. Write them directly in SKILL.md, or in one reference file if they exceed one screen.

**Phase-based** — write one file per phase, named `references/phase-N-<name>.md`:

```
# Phase N · <Name>

**Entry:** [what must be true before this phase can start]

## Step 1 · <name>
...

## Step 2 · <name>
...

## Exit Condition
[the one binary fact that confirms this phase is complete]
```

**Inline** — no reference files. Numbered steps go directly in SKILL.md under the SOP section.

---

## Step 7 · Write SKILL.md

Using all recorded values and any reference files from Step 6, write SKILL.md following `skill-format.md`.

Mapping:
- `STEPS` → SOP flowchart (one node per step, gate transitions as 🛑 nodes)
- `EXIT_CONDITIONS` → gate transition labels in the flowchart
- `GATES` + `HARD_RULES` → Hard Rules section
- References table → one row per phase file, or "None — all instructions are inline"

For the Structured Output block: show current phase/step and the key state fields the human needs to orient.

---

## Step 8 · Wait for approval

Show all files — SKILL.md and every phase reference file — to the human. Do not save until the human explicitly approves. If changes are requested, apply them and show the files again.
