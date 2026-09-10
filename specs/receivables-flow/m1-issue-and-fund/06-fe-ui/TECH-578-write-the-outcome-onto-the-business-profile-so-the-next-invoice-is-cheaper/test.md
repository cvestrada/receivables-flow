# Test Plan · Write the outcome onto the business profile so the next invoice is cheaper

**Layer:** Contract unit (Hardhat) for what an ending does to the record · E2E (Playwright) for
Ironline's screen

**Files:**
- `contracts/ens/test/unit/encoding.test.ts`
- `apps/e2e/tests/outcome.spec.ts`

**Run:**
- `cd contracts/ens && npm run test:unit`
- `npm test -w @rf/e2e -- outcome.spec.ts`

---

## Tests

**The record after an ending**

- **applyOutcome**
  - [happy-path] paying adds one invoice paid on time, and a business that scored 75 now scores 79
  - [happy-path] not paying adds one invoice never paid, and a business that scored 75 now scores 64
  - [boundary] how many invoices the business has sold is unchanged by either ending
  - [boundary] a business nobody has lent to before is scored for the first time by its first ending, rather than staying unrated
  - [boundary] applying the same ending to the record twice is not the same as applying it once — the caller decides when it happens, so the record moves each time it is asked to

- **the record a business starts with**
  - [happy-path] scores 75 — neither perfect nor unrated, so an ending can move it in either direction
  - [boundary] names every count the page publishes, so onboarding writes a whole record rather than part of one

- **the settlement record**
  - [happy-path] is one of the records a page grants the platform, so a page issued before it existed can be written to after the next onboard run
  - [boundary] scopes its write permission to itself and not to the counts beside it

**Ironline Freight's portal — day 60**

- **paying**
  - [happy-path] the panel states what Ironline's public record says before anything is pressed
  - [happy-path] paying shows a higher score after the ending than before it
  - [happy-path] paying shows the next invoice costing less than it did before the ending
  - [boundary] pressing again reports what was already written down rather than adding the ending twice

- **not paying**
  - [unhappy-path] not paying shows a lower score after the ending than before it
  - [unhappy-path] not paying shows the next invoice costing more than it did before the ending
  - [boundary] when the page could not be updated the panel says so plainly and still shows the two records side by side
