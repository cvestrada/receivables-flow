export interface CategoryGroupCategory { id: string; name: string; order: number }
export interface CategoryGroupActor { id: string; name: string; categoryId: string; order: number }

export interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  actors: CategoryGroupActor[];
}

/** Groups actors under their own category, ordered by the category's own `order` field —
 *  never by the order actors happen to appear in the input list. A category with exactly
 *  one actor still gets its own group here; the sidebar itself decides whether to render
 *  that actor as its own row or fold its journeys directly under the category header. */
export function groupActorsByCategory(
  categories: readonly CategoryGroupCategory[],
  users: readonly CategoryGroupActor[],
): CategoryGroup[] {
  return [...categories]
    .sort((a, b) => a.order - b.order)
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      actors: users.filter((user) => user.categoryId === category.id).sort((a, b) => a.order - b.order),
    }));
}
