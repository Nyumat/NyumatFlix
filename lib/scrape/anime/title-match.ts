import { stripSeasonSuffix } from "@/lib/anilist-franchise";

const TITLE_SEPARATOR = /[^\p{L}\p{N}]+/gu;

export const normalizeAnimeTitle = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[''']/g, "'")
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

export const animeFranchisePrefixMatch = (
  candidate: string,
  franchiseKey: string,
): boolean => {
  const normalizedCandidate = normalizeAnimeTitle(stripSeasonSuffix(candidate));
  const normalizedKey = normalizeAnimeTitle(stripSeasonSuffix(franchiseKey));
  if (!normalizedCandidate || !normalizedKey) return false;
  if (normalizedCandidate === normalizedKey) return true;
  if (!normalizedCandidate.startsWith(`${normalizedKey} `)) return false;

  const trimmedCandidate = stripSeasonSuffix(candidate).trim();
  const trimmedKey = stripSeasonSuffix(franchiseKey).trim();
  if (!trimmedCandidate.toLowerCase().startsWith(trimmedKey.toLowerCase())) {
    return false;
  }

  const rest = trimmedCandidate.slice(trimmedKey.length);
  // reject movies/specials that share the franchise prefix
  // ("One Piece Episode of Merry", "One Piece Film Z", …)
  if (
    /^\s+(?:episode\s+of|film|movie|ova|ona|special|the\s+movie)\b/i.test(rest)
  ) {
    return false;
  }
  return (
    rest === "" ||
    /^\s*[:|-]/.test(rest) ||
    /^\s+season\s+\d/i.test(rest) ||
    /^\s+\d(?:st|nd|rd|th)\s+season/i.test(rest)
  );
};

const stripAnimeProviderStatusPrefix = (label: string): string =>
  stripAnimeSearchMetadata(label)
    .replace(
      /^(?:(?:completed|ongoing|upcoming|sub|dub|anime|movie|tv|ona|ova)\s+)+/gi,
      "",
    )
    .trim();

export const animeSearchLabelMatches = (
  label: string,
  expectedTitles: readonly string[],
): boolean => {
  const candidateLabels = [
    stripAnimeSearchMetadata(label),
    stripAnimeEpisodeSuffix(label),
    stripAnimeProviderStatusPrefix(label),
    stripSeasonSuffix(stripAnimeSearchMetadata(label)),
    stripSeasonSuffix(stripAnimeEpisodeSuffix(label)),
    stripSeasonSuffix(stripAnimeProviderStatusPrefix(label)),
  ];

  for (const candidateLabel of candidateLabels) {
    if (isExactAnimeTitleMatch(candidateLabel, expectedTitles)) {
      return true;
    }

    for (const expected of expectedTitles) {
      if (animeFranchisePrefixMatch(candidateLabel, expected)) {
        return true;
      }
    }
  }

  return extractAnimeSearchAltTitles(label).some((alt) =>
    isExactAnimeTitleMatch(stripAnimeSearchMetadata(alt), expectedTitles),
  );
};
