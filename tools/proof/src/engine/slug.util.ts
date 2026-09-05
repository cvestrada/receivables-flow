const MAX_SLUG_LENGTH = 60;

/**
 * Turns any text into a lowercase, hyphen-separated slug -- apostrophes and quotes are
 * dropped outright (so "investor's" becomes "investors", never "investor-s"), every
 * other run of non-alphanumeric characters (spaces, punctuation, existing hyphens)
 * collapses into a single hyphen, and the result is capped at 60 characters, backing up
 * to the end of the last whole word rather than cutting mid-word.
 */
export function toSlug(text: string): string {
  const withoutQuotes = text.replace(/['’"“”]/g, '');
  const full = withoutQuotes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (full.length <= MAX_SLUG_LENGTH) return full;

  const truncated = full.slice(0, MAX_SLUG_LENGTH);
  const lastHyphen = truncated.lastIndexOf('-');
  /** Only back up to a whole-word boundary when one actually exists within the first 60
   *  characters -- a single word longer than 60 characters has no earlier hyphen to back
   *  up to, so it's kept as-is rather than returning an empty string. */
  const wholeWords = lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated;
  return wholeWords.replace(/-+$/, '');
}

/**
 * Makes every item's slug unique among its siblings under the same parent -- two items
 * that derive the same base slug (e.g. two milestones both named "Review" under the same
 * phase) would otherwise collide, silently making the second one unreachable by its own
 * link. The first occurrence of a base slug within a parent keeps it bare; each later
 * collision counts up (`-2`, `-3`, ...) against the set of slugs already assigned to that
 * parent -- not just against how many times the same base slug was seen -- so a generated
 * suffix can never land on a slug some other sibling already claimed (e.g. a base slug
 * "review" and a literal base slug "review-2" under the same parent must never both end
 * up assigned "review-2").
 */
export function dedupeSlugsWithinParent<T>(
  items: readonly T[],
  parentKeyOf: (item: T) => string,
  slugOf: (item: T) => string,
): string[] {
  const takenSlugsByParent = new Map<string, Set<string>>();
  return items.map((item) => {
    const parentKey = parentKeyOf(item);
    const baseSlug = slugOf(item);
    let taken = takenSlugsByParent.get(parentKey);
    if (!taken) {
      taken = new Set<string>();
      takenSlugsByParent.set(parentKey, taken);
    }

    let candidate = baseSlug;
    for (let suffix = 2; taken.has(candidate); suffix += 1) {
      candidate = `${baseSlug}-${suffix}`;
    }
    taken.add(candidate);
    return candidate;
  });
}
