/**
 * Build search queries for adult catalogs (Hentaigasm WP REST, TMDB title match, etc.).
 *
 * Full AniList titles often return zero WP hits because punctuation and long
 * romanizations do not match site post titles. Short franchise tokens and compact
 * romanizations (joshi ochi → joshiochi) mirror how those sites are searched.
 */

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "ga",
  "kara",
  "ni",
  "no",
  "the",
  "to",
  "wa",
  "wo",
]);

const uniqueNonEmpty = (values: readonly string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

/** Franchise name before an explanatory subtitle (colon / em dash). */
export const stripAdultCatalogSubtitle = (title: string): string => {
  const match = title.match(/^([^:：—–-]+?)(?:\s*[:：—–-]\s*|$)/);
  return (match?.[1] ?? title).replace(/[!?…]+$/g, "").trim();
};

const tokenizeAdultCatalogTitle = (title: string): string[] =>
  title
    .normalize("NFKC")
    .replace(/[.…]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

export const significantAdultCatalogWords = (title: string): string[] =>
  tokenizeAdultCatalogTitle(title).filter(
    (word) =>
      word.length >= 2 &&
      !SEARCH_STOP_WORDS.has(word.toLocaleLowerCase("en-US")),
  );

/** Join adjacent romanization tokens (onna + no + ko → onnanoko). */
export const compactAdultCatalogTokens = (
  words: readonly string[],
  start = 0,
  count = 2,
): string | null => {
  const slice = words
    .slice(start, start + count)
    .map((word) => word.toLocaleLowerCase("en-US").replace(/-/g, ""));
  if (slice.length < count) {
    return null;
  }

  const compact = slice.join("");
  return compact.length >= 4 ? compact : null;
};

const buildPrefixQueries = (words: readonly string[]): string[] => {
  const queries: string[] = [];
  const maxWords = Math.min(4, words.length);

  for (let count = 2; count <= maxWords; count += 1) {
    queries.push(words.slice(0, count).join(" "));
  }

  return queries;
};

const buildCompactQueries = (words: readonly string[]): string[] => {
  const queries: string[] = [];

  const pair = compactAdultCatalogTokens(words, 0, 2);
  if (pair) {
    queries.push(pair);
    queries.push(pair.charAt(0).toUpperCase() + pair.slice(1));
  }

  const triple = compactAdultCatalogTokens(words, 0, 3);
  if (triple && triple !== pair) {
    queries.push(triple);
  }

  return queries;
};

/** Turn slug segments into human search phrases (joshi-ochi → "joshi ochi"). */
export const adultCatalogSlugToSearchQueries = (slug: string): string[] => {
  const segments = slug
    .trim()
    .toLowerCase()
    .split("-")
    .filter((segment) => segment.length >= 2);
  if (segments.length === 0) {
    return [];
  }

  const words = segments.map(
    (segment) => segment.charAt(0).toUpperCase() + segment.slice(1),
  );

  return uniqueNonEmpty([
    ...buildPrefixQueries(words),
    ...buildCompactQueries(words),
  ]);
};

const applyKnownAdultCatalogQueryAliases = (query: string): string[] => {
  const aliases: string[] = [];

  if (/yanmama/i.test(query)) {
    aliases.push(query.replace(/yanmama/gi, "yan mama"));
  }
  if (/haha ga kita/i.test(query)) {
    aliases.push(query.replace(/haha ga kita/gi, "Gibo ga kita"));
  }
  if (/joshi\s+ochi/i.test(query)) {
    aliases.push(query.replace(/joshi\s+ochi/gi, "Joshiochi"));
    aliases.push("Joshiochi");
  }
  if (/joshiochi/i.test(query)) {
    aliases.push("Joshi Ochi");
  }

  return aliases;
};

/**
 * Ordered search queries for adult catalogs. Earlier entries are tried first.
 */
export const buildAdultCatalogSearchQueries = (
  titles: readonly string[],
  options?: { slugCandidates?: readonly string[] },
): string[] => {
  const ordered: string[] = [];

  const push = (...values: readonly string[]) => {
    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }
      ordered.push(trimmed);
      ordered.push(...applyKnownAdultCatalogQueryAliases(trimmed));
    }
  };

  for (const title of titles) {
    const trimmed = title.trim();
    if (!trimmed) {
      continue;
    }

    const franchise = stripAdultCatalogSubtitle(trimmed);
    const franchiseWords = significantAdultCatalogWords(franchise);
    const fullWords = significantAdultCatalogWords(trimmed);

    push(
      ...buildPrefixQueries(franchiseWords),
      ...buildCompactQueries(franchiseWords),
      franchise,
      ...buildPrefixQueries(fullWords.slice(0, 4)),
    );

    if (
      !/[:：]/.test(trimmed) &&
      trimmed.length <= 48 &&
      !/\.{2,}/.test(trimmed)
    ) {
      push(trimmed);
    }
  }

  for (const slug of options?.slugCandidates ?? []) {
    push(...adultCatalogSlugToSearchQueries(slug));
  }

  return uniqueNonEmpty(ordered);
};

/** @deprecated Use {@link buildAdultCatalogSearchQueries}. */
export const expandAdultAnimeSearchQueries = (
  titles: readonly string[],
): string[] => buildAdultCatalogSearchQueries(titles);
