import { cancelResponseBody, scrapeFetch } from "../fetch";

type AniListTitleResponse = {
  data?: {
    Media?: {
      title?: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
      };
      duration?: number | null;
      episodes?: number | null;
      isAdult?: boolean | null;
      format?: string | null;
      genres?: string[] | null;
    };
  };
};

export type AnilistMediaMeta = {
  titles: string[];
  english: string | null;
  romaji: string | null;
  native: string | null;
  durationMinutes: number | null;
  episodes: number | null;
  isAdult: boolean;
  genres: string[];
  format: string | null;
};

const titleCache = new Map<number, string>();
const titleCandidatesCache = new Map<number, string[]>();
const mediaMetaCache = new Map<number, AnilistMediaMeta>();
const MAX_ANILIST_META_CACHE_ENTRIES = 500;

const setBounded = <T>(map: Map<number, T>, key: number, value: T): void => {
  map.delete(key);
  map.set(key, value);

  while (map.size > MAX_ANILIST_META_CACHE_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
};

export const fetchAnilistTitleCandidates = async (
  anilistId: number,
): Promise<string[]> => {
  const cached = titleCandidatesCache.get(anilistId);
  if (cached) {
    return cached;
  }

  try {
    const response = await scrapeFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Media(id: ${anilistId}) { title { romaji english native } duration episodes isAdult format genres } }`,
      }),
    });

    if (!response.ok) {
      await cancelResponseBody(response);
      return [];
    }

    const payload = (await response.json()) as AniListTitleResponse;
    const media = payload.data?.Media;
    const candidates = [
      media?.title?.english?.trim(),
      media?.title?.romaji?.trim(),
      media?.title?.native?.trim(),
    ].filter((title): title is string => Boolean(title));
    const unique = [...new Set(candidates)];

    if (unique.length > 0) {
      setBounded(titleCandidatesCache, anilistId, unique);
      setBounded(titleCache, anilistId, unique[0] ?? "");
    }

    return unique;
  } catch {
    return [];
  }
};

export const fetchAnilistSearchQuery = async (
  anilistId: number,
): Promise<string | null> => {
  const cached = titleCache.get(anilistId);
  if (cached) {
    return cached;
  }

  return (await fetchAnilistTitleCandidates(anilistId))[0] ?? null;
};

export const fetchAnilistMediaMeta = async (
  anilistId: number,
): Promise<AnilistMediaMeta | null> => {
  const cached = mediaMetaCache.get(anilistId);
  if (cached) {
    return cached;
  }

  try {
    const response = await scrapeFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Media(id: ${anilistId}) { title { romaji english native } duration episodes isAdult format genres } }`,
      }),
    });

    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }

    const payload = (await response.json()) as AniListTitleResponse;
    const media = payload.data?.Media;
    if (!media) {
      return null;
    }

    const titles = [
      media.title?.english?.trim(),
      media.title?.romaji?.trim(),
      media.title?.native?.trim(),
    ].filter((title): title is string => Boolean(title));
    const uniqueTitles = [...new Set(titles)];

    const meta: AnilistMediaMeta = {
      titles: uniqueTitles,
      english: media.title?.english?.trim() ?? null,
      romaji: media.title?.romaji?.trim() ?? null,
      native: media.title?.native?.trim() ?? null,
      durationMinutes:
        typeof media.duration === "number" && media.duration > 0
          ? media.duration
          : null,
      episodes:
        typeof media.episodes === "number" && media.episodes > 0
          ? media.episodes
          : null,
      isAdult: media.isAdult === true,
      genres: (media.genres ?? []).filter(
        (genre): genre is string =>
          typeof genre === "string" && genre.length > 0,
      ),
      format: typeof media.format === "string" ? media.format : null,
    };

    setBounded(mediaMetaCache, anilistId, meta);
    if (uniqueTitles.length > 0) {
      setBounded(titleCandidatesCache, anilistId, uniqueTitles);
      setBounded(titleCache, anilistId, uniqueTitles[0] ?? "");
    }

    return meta;
  } catch {
    return null;
  }
};

const malToAnilistIdCache = new Map<number, number>();
const anilistToMalIdCache = new Map<number, number>();

/** Resolve AniList id → MyAnimeList id via AniList's `idMal` field. */
export const fetchMalIdByAnilist = async (
  anilistId: number,
): Promise<number | null> => {
  const cached = anilistToMalIdCache.get(anilistId);
  if (cached) {
    return cached;
  }

  try {
    const response = await scrapeFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Media(id: ${anilistId}) { idMal } }`,
      }),
    });

    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }

    const payload = (await response.json()) as {
      data?: { Media?: { idMal?: number | null } | null };
    };
    const malId = payload.data?.Media?.idMal;
    if (typeof malId !== "number" || !Number.isInteger(malId) || malId <= 0) {
      return null;
    }

    setBounded(anilistToMalIdCache, anilistId, malId);
    return malId;
  } catch {
    return null;
  }
};

/** Resolve MyAnimeList id → AniList id (AniBridge often maps TMDB→mal only). */
export const fetchAnilistIdByMal = async (
  malId: number,
): Promise<number | null> => {
  const cached = malToAnilistIdCache.get(malId);
  if (cached) {
    return cached;
  }

  try {
    const response = await scrapeFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Media(idMal: ${malId}, type: ANIME) { id } }`,
      }),
    });

    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }

    const payload = (await response.json()) as {
      data?: { Media?: { id?: number | null } | null };
    };
    const anilistId = payload.data?.Media?.id;
    if (
      typeof anilistId !== "number" ||
      !Number.isInteger(anilistId) ||
      anilistId <= 0
    ) {
      return null;
    }

    setBounded(malToAnilistIdCache, malId, anilistId);
    return anilistId;
  } catch {
    return null;
  }
};

export type AnimeSearchContext = {
  /** Keywords to submit to a provider's search endpoint (season-specific titles first). */
  searchQueries: string[];
  /**
   * Titles a search hit must match — season-specific AniList titles only.
   * The generic route query ("Attack on Titan") exact-matches the Season 1
   * entry of multi-season franchises, which plays the wrong episode since
   * episode numbers are relative to the AniList entry. Falls back to the
   * query only when AniList returns no titles.
   */
  matchTitles: string[];
};

/** Pure core of {@link resolveAnimeSearchContext}, split out for tests. */
export const buildAnimeSearchContext = (
  query: string | undefined,
  anilistTitles: readonly string[],
): AnimeSearchContext => {
  const trimmed = query?.trim();
  const searchQueries = [
    ...new Set(
      [...anilistTitles, trimmed].filter((title): title is string =>
        Boolean(title),
      ),
    ),
  ];
  const matchTitles =
    anilistTitles.length > 0 ? [...anilistTitles] : trimmed ? [trimmed] : [];

  return { searchQueries, matchTitles };
};

export const resolveAnimeSearchContext = async (input: {
  anilistId: number;
  query?: string;
}): Promise<AnimeSearchContext> => {
  const fromAnilist = await fetchAnilistTitleCandidates(input.anilistId);
  const context = buildAnimeSearchContext(input.query, fromAnilist);

  if (context.searchQueries.length === 0) {
    throw new Error(
      `Unable to resolve search title for AniList ${input.anilistId}`,
    );
  }

  return context;
};

export const resolveAnimeSearchQueries = async (input: {
  anilistId: number;
  query?: string;
}): Promise<string[]> => (await resolveAnimeSearchContext(input)).searchQueries;

export const resolveAnimeSearchQuery = async (input: {
  anilistId: number;
  query?: string;
}): Promise<string> => (await resolveAnimeSearchQueries(input))[0]!;
