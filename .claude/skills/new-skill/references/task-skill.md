# Task Skill Procedure

**What:** Design and write a skill that does exactly one thing — one input, one output.

**Why:** Simple tasks don't need phases — five questions are enough to fully define them.

**How:** Ask what it does, when to trigger it, what it needs, what it produces, and what it must never do — then write the SKILL.md.

---

## Step 1 · Ask what it does

Ask: "What does this skill do?"

Accept one sentence only. Plain English. If the answer is longer than one sentence, ask the human to distill it.

Record as: `WHAT`

---

## Step 2 · Ask when to invoke it

Ask: "When should this skill fire — what does the user say or do?"

The answer must be specific enough that the trigger does not match unrelated requests. If the answer is vague ("when the user wants help"), push back: "What specific words or actions indicate this — not similar skills?"

Record as: `TRIGGER`

---

## Step 3 · Ask what it needs to start

Ask: "What must already exist or be known before this skill can run?"

If the answer is "nothing", that is valid — record it. If the answer is a file path, a prior step's output, or a user-stated value, record it exactly.

Record as: `PRECONDITIONS`

---

## Step 4 · Ask what it produces

Ask: "What does this skill produce when it is done — one concrete thing you can point to?"

Not a feeling or a state. A file, a message, a command output, a value. If the answer is vague, ask: "How would I know this skill finished correctly?"

Record as: `OUTPUT`

---

## Step 5 · Ask what it must never do

Ask: "Are there hard constraints — things this skill must never do?"

If the answer is none, skip this step. Record genuine hard constraints only, not preferences.

Record as: `CONSTRAINTS`

---

## Step 6 · Write the skill file

Using all five recorded values, write the skill file following `skill-format.md`.

Mapping:
- `WHAT` → `**What:**` field
- `TRIGGER` → `description:` frontmatter
- `PRECONDITIONS` → opening of `**How:**` field
- `OUTPUT` → Structured Output section
- `CONSTRAINTS` → Hard Rules section

For the SOP diagram: a task skill has no phases. The flowchart is: invoked → [steps] → output → done.

---

## Step 7 · Wait for approval

Show the complete skill file to the human. Do not save until the human explicitly approves. If changes are requested, apply them and show the file again.
