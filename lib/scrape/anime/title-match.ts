const TITLE_SEPARATOR = /[^\p{L}\p{N}]+/gu;

export const normalizeAnimeTitle = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(TITLE_SEPARATOR, " ")
    .trim()
    .replace(/\s+/g, " ");

export const isExactAnimeTitleMatch = (
  candidate: string,
  expectedTitles: readonly string[],
): boolean => {
  const normalizedCandidate = normalizeAnimeTitle(candidate);
  if (!normalizedCandidate) return false;

  return expectedTitles.some(
    (title) => normalizeAnimeTitle(title) === normalizedCandidate,
  );
};

/** Strip "Episodes: … Alt Titles: … Status: …" junk from AnimeGG search labels. */
export const stripAnimeSearchMetadata = (label: string): string => {
  const cleaned = label
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(/\bEpisodes\s*:/i)[0]?.trim() ?? cleaned;
};

/** Strip trailing "Episode N" / "Ep. N" from episode page titles. */
export const stripAnimeEpisodeSuffix = (label: string): string =>
  stripAnimeSearchMetadata(label)
    .replace(/\s*[-|:·]\s*episode\s*\d+\b.*$/i, "")
    .replace(/\s+episode\s*\d+\b.*$/i, "")
    .replace(/\s+ep\.?\s*\d+\b.*$/i, "")
    .trim();

export const extractAnimeSearchAltTitles = (label: string): string[] => {
  const cleaned = label
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleaned.match(/\bAlt Titles\s*:\s*(.*?)\s*(?:Status\s*:|$)/i);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(/[,;]/)
    .map((title) => title.trim())
    .filter((title) => title.length > 0);
};

export const animeSearchLabelMatches = (
  label: string,
  expectedTitles: readonly string[],
): boolean => {
  const primary = stripAnimeSearchMetadata(label);
  if (isExactAnimeTitleMatch(primary, expectedTitles)) {
    return true;
  }

  const withoutEpisode = stripAnimeEpisodeSuffix(label);
  if (
    withoutEpisode !== primary &&
    isExactAnimeTitleMatch(withoutEpisode, expectedTitles)
  ) {
    return true;
  }

  return extractAnimeSearchAltTitles(label).some((alt) =>
    isExactAnimeTitleMatch(alt, expectedTitles),
  );
};
