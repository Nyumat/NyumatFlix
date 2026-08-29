import { stripSeasonSuffix } from "@/lib/anilist-franchise";

const TITLE_SEPARATOR = /[^\p{L}\p{N}]+/gu;

/** Noise labels adult catalogs append to every post title (e.g. "Uncensored 6 Subbed"). */
const ADULT_RELEASE_SUFFIX = /\b(uncensored|censored|subbed|dubbed)\b/gi;

export const normalizeAnimeTitle = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[''']/g, "'")
    .replace(TITLE_SEPARATOR, " ")
    .trim()
    .replace(/\s+/g, " ");

/** Strip trailing MAL/AnimeGG format labels like `(TV)` / `(Movie)`. */
export const stripAnimeFormatSuffix = (label: string): string =>
  label
    .replace(/\s*\((?:TV|Movie|OVA|ONA|Special|Web|TV Special)\)\s*$/i, "")
    .trim();

/**
 * Strip adult-catalog release noise ("Uncensored", "Subbed", …) before title
 * comparison. These labels are present on nearly every Hentaigasm/Hentaini post
 * title and would otherwise tank fuzzy similarity.
 */
export const stripAdultReleaseSuffix = (label: string): string =>
  stripAnimeFormatSuffix(label).replace(ADULT_RELEASE_SUFFIX, "").trim();

const buildTrigrams = (value: string): Set<string> => {
  const padded = `  ${value}  `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i += 1) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
};

const trigramJaccard = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const ga = buildTrigrams(a);
  const gb = buildTrigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let intersection = 0;
  for (const gram of ga) {
    if (gb.has(gram)) intersection += 1;
  }
  return intersection / (ga.size + gb.size - intersection);
};

export const isExactAnimeTitleMatch = (
  candidate: string,
  expectedTitles: readonly string[],
): boolean => {
  const normalizedCandidate = normalizeAnimeTitle(
    stripAnimeFormatSuffix(candidate),
  );
  if (!normalizedCandidate) return false;

  return expectedTitles.some(
    (title) =>
      normalizeAnimeTitle(stripAnimeFormatSuffix(title)) ===
      normalizedCandidate,
  );
};

/**
 * Fuzzy title match for adult catalogs whose post titles diverge from AniList
 * via typos (`jimko`/`jimiko`), extra suffixes (`Uncensored`, `Subbed`), or
 * punctuation. Uses character 3-gram Jaccard similarity which tolerates
 * character-level edits and word reordering while penalizing unrelated titles
 * via the union denominator.
 *
 * Tuned to 0.60 against a real Hentaigasm ↔ AniList corpus: 7/7 true positives
 * (incl. Jimihen, gibo/haha) with 0 false positives across 10 decoy pairs.
 * Stable across the 0.55–0.70 range, so the threshold is forgiving.
 */
export const fuzzyMatchAnimeTitle = (
  candidate: string,
  expectedTitles: readonly string[],
  threshold = 0.6,
): boolean => {
  const normalizedCandidate = normalizeAnimeTitle(
    stripAdultReleaseSuffix(candidate),
  );
  if (!normalizedCandidate) return false;

  return expectedTitles.some(
    (title) =>
      trigramJaccard(
        normalizedCandidate,
        normalizeAnimeTitle(stripAdultReleaseSuffix(title)),
      ) >= threshold,
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
    stripAnimeFormatSuffix(stripAnimeSearchMetadata(label)),
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
