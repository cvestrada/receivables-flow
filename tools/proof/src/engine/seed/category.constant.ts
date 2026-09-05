export interface CategoryDefinition {
  id: string;
  name: string;
  order: number;
}

/** Receivables Flow has one product and two sides to it, so unlike Orbbit's own proof
 *  tool (Fintech / Market Intelligence / Growth) there is a single category here. Kept as
 *  a list rather than inlined so adding a second product line later is an append, not a
 *  refactor of every seed file. */
export const CATEGORIES: CategoryDefinition[] = [
  { id: 'receivables-flow', name: 'Receivables Flow', order: 1 },
];
