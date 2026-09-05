/** The enums the journey board renders against. Copied from the engine's own db types so
 *  the app carries no import from the seed layer. */
export type StepStatus = 'built' | 'partially_built' | 'proposed';
export type TestResultStatus = 'passed' | 'failed';
/** Which sponsor's technology does the work in a step — the badge on the step card.
 *  'hedera' is Hedera-native work that is not ATS (scheduled transactions, settlement),
 *  kept separate so the ATS count is not quietly inflated by it. */
export type Sponsor = 'hedera-ats' | 'hedera' | 'privy' | 'ensv2';
