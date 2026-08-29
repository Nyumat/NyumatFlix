/**
 * Slug variants for adult catalogs where site slugs diverge from AniList titles
 * (e.g. yan-mama vs yanmama, gibo vs haha).
 */
export const expandAdultAnimeSlugAliases = (slug: string): string[] => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>([normalized]);

  if (normalized.includes("yanmama")) {
    variants.add(normalized.replace(/yanmama/g, "yan-mama"));
  }
  if (normalized.includes("yan-mama")) {
    variants.add(normalized.replace(/yan-mama/g, "yanmama"));
  }
  if (normalized.includes("haha-ga")) {
    variants.add(normalized.replace(/haha-ga/g, "gibo-ga"));
  }
  if (normalized.includes("gibo-ga")) {
    variants.add(normalized.replace(/gibo-ga/g, "haha-ga"));
  }

  return [...variants];
};

export { expandAdultAnimeSearchQueries } from "./adult-catalog-search";
