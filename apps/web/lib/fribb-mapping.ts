import "server-only";

import {
  FRIBB_BUNDLED_FILE,
  readBundledJson,
} from "@/lib/anime/bundled-mapping-files";

export type FribbMappingItem = {
  anilist_id?: number;
  themoviedb_id?:
    | number
    | { tv?: number | number[]; movie?: number | number[] };
  season?: {
    tmdb?: number;
    tvdb?: number;
  };
  episode_offset?: {
    tmdb?: number;
    tvdb?: number;
  };
};

export type FribbAnimeRow = FribbMappingItem & { anilist_id: number };

export const normalizeFribbTmdbShowId = (
  value: FribbMappingItem["themoviedb_id"],
): number | null => {
  if (typeof value === "number") return value > 0 ? value : null;
  return firstPositiveId(value?.tv);
};

const firstPositiveId = (
  value: number | number[] | undefined,
): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "number" && Number.isInteger(entry) && entry > 0) {
        return entry;
      }
    }
  }

  return null;
};

/** Fribb stores some movie TMDB IDs as arrays — normalize to a single id. */
export const normalizeFribbTmdbId = firstPositiveId;

export type FribbTmdbEntry = {
  tv?: number;
  movie?: number;
  season?: number;
};

export type FribbTmdbMapping = {
  id: number;
  type: "movie" | "tv";
  season?: number;
};

const FRIBB_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json";
const FRIBB_FETCH_TIMEOUT_MS = 8000;
const FRIBB_MEMORY_TTL_MS = 60 * 60 * 24 * 1000;

type FribbListCache = {
  value: FribbAnimeRow[];
  expiresAt: number;
};

type FribbRawListCache = {
  value: FribbMappingItem[];
  expiresAt: number;
};

type FribbMappingCache = {
  value: Record<number, FribbTmdbEntry>;
  expiresAt: number;
};

let cachedFribbList: FribbListCache | null = null;
let inflightFribbList: Promise<FribbAnimeRow[]> | null = null;
let cachedFribbRawList: FribbRawListCache | null = null;
let inflightFribbRawList: Promise<FribbMappingItem[]> | null = null;
let cachedFribbMapping: FribbMappingCache | null = null;
let inflightFribbMapping: Promise<Record<number, FribbTmdbEntry>> | null = null;

export const resolveFribbTmdbMapping = (
  entry: FribbTmdbEntry | undefined,
  format?: string | null,
): FribbTmdbMapping | null => {
  if (!entry) return null;

  if (format === "MOVIE" && entry.movie) {
    return { id: entry.movie, type: "movie" };
  }

  if (entry.tv) {
    return { id: entry.tv, type: "tv", season: entry.season };
  }

  if (entry.movie) {
    return { id: entry.movie, type: "movie" };
  }

  return null;
};

const parseFribbAnimeList = (data: FribbMappingItem[]): FribbAnimeRow[] =>
  data.filter(
    (item): item is FribbAnimeRow =>
      typeof item.anilist_id === "number" && item.anilist_id > 0,
  );

const loadFribbRawList = async (): Promise<FribbMappingItem[]> => {
  const bundled = await readBundledJson<FribbMappingItem[]>(FRIBB_BUNDLED_FILE);
  if (bundled) {
    return bundled;
  }

  const res = await fetch(FRIBB_URL, {
    signal: AbortSignal.timeout(FRIBB_FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Fribb mapping fetch failed with status ${res.status}`);
  }

  return (await res.json()) as FribbMappingItem[];
};

/**
 * Full, unfiltered Fribb rows (including entries with no `anilist_id`).
 *
 * Roughly a quarter of Fribb's dataset has a MyAnimeList id but no AniList
 * id (or vice versa) — consumers that only need MAL/TMDB pairing (e.g. the
 * MAL id-resolver) should use this instead of `getFribbAnimeList`, which
 * drops any row lacking `anilist_id`.
 */
export const getFribbRawList = async (): Promise<FribbMappingItem[]> => {
  const now = Date.now();
  if (cachedFribbRawList && cachedFribbRawList.expiresAt > now) {
    return cachedFribbRawList.value;
  }

  if (!inflightFribbRawList) {
    inflightFribbRawList = loadFribbRawList()
      .then((value) => {
        cachedFribbRawList = {
          value,
          expiresAt: Date.now() + FRIBB_MEMORY_TTL_MS,
        };
        return value;
      })
      .finally(() => {
        inflightFribbRawList = null;
      });
  }

  return inflightFribbRawList;
};

export const getFribbAnimeList = async (): Promise<FribbAnimeRow[]> => {
  const now = Date.now();
  if (cachedFribbList && cachedFribbList.expiresAt > now) {
    return cachedFribbList.value;
  }

  if (!inflightFribbList) {
    inflightFribbList = getFribbRawList()
      .then(parseFribbAnimeList)
      .then((value) => {
        cachedFribbList = {
          value,
          expiresAt: Date.now() + FRIBB_MEMORY_TTL_MS,
        };
        return value;
      })
      .finally(() => {
        inflightFribbList = null;
      });
  }

  return inflightFribbList;
};

const buildFribbMapping = async (): Promise<Record<number, FribbTmdbEntry>> => {
  const data = await getFribbAnimeList();
  const mapping: Record<number, FribbTmdbEntry> = {};

  for (const item of data) {
    if (!item.themoviedb_id) continue;

    const entry: FribbTmdbEntry = {};
    const tvId = normalizeFribbTmdbShowId(item.themoviedb_id);
    const movieId =
      typeof item.themoviedb_id === "object"
        ? firstPositiveId(item.themoviedb_id.movie)
        : null;
    if (tvId) entry.tv = tvId;
    if (movieId) entry.movie = movieId;
    if (item.season?.tmdb && item.season.tmdb > 0) {
      entry.season = item.season.tmdb;
    }

    if (entry.tv || entry.movie) {
      mapping[item.anilist_id] = entry;
    }
  }

  return mapping;
};

export const getFribbMapping = async (): Promise<
  Record<number, FribbTmdbEntry>
> => {
  const now = Date.now();
  if (cachedFribbMapping && cachedFribbMapping.expiresAt > now) {
    return cachedFribbMapping.value;
  }

  if (!inflightFribbMapping) {
    inflightFribbMapping = buildFribbMapping()
      .then((value) => {
        cachedFribbMapping = {
          value,
          expiresAt: Date.now() + FRIBB_MEMORY_TTL_MS,
        };
        return value;
      })
      .finally(() => {
        inflightFribbMapping = null;
      });
  }

  return inflightFribbMapping;
};

/** Fribb uses 0 or omits `season.tmdb` for the first TMDB season. */
const fribbTmdbSeasonNumber = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

export const resolveFribbPlaybackCoords = (
  rows: readonly FribbAnimeRow[],
  tmdbShowId: number,
  seasonNumber: number,
  episodeNumber: number,
): {
  anilistId: number;
  relativeEpisode: number;
  segmentStart: number;
} | null => {
  const seasonRows = rows
    .filter(
      (row) =>
        normalizeFribbTmdbShowId(row.themoviedb_id) === tmdbShowId &&
        fribbTmdbSeasonNumber(row) === seasonNumber,
    )
    .sort(
      (a, b) => (a.episode_offset?.tmdb ?? 0) - (b.episode_offset?.tmdb ?? 0),
    );

  if (seasonRows.length === 0) return null;

  let chosen = seasonRows[0]!;
  for (const row of seasonRows) {
    const offset = row.episode_offset?.tmdb ?? 0;
    if (
      episodeNumber > offset &&
      offset >= (chosen.episode_offset?.tmdb ?? 0)
    ) {
      chosen = row;
    }
  }

  const offset = chosen.episode_offset?.tmdb ?? 0;
  const segmentStart = offset > 0 ? offset + 1 : 1;
  const relativeEpisode =
    offset > 0 ? Math.max(1, episodeNumber - offset) : episodeNumber;

  return {
    anilistId: chosen.anilist_id,
    relativeEpisode,
    segmentStart,
  };
};

export const getTmdbIdFromFribb = async (
  anilistId: number,
  format?: string | null,
) => {
  const mapping = await getFribbMapping();
  return resolveFribbTmdbMapping(mapping?.[anilistId], format);
};

export const findAnilistIdByTmdbId = (
  mapping: Record<number, FribbTmdbEntry>,
  tmdbId: number,
  type: "movie" | "tv",
): number | null => {
  for (const [anilistId, entry] of Object.entries(mapping)) {
    if (
      entry[type] === tmdbId &&
      (type !== "tv" || !entry.season || entry.season === 1)
    ) {
      const parsedId = Number(anilistId);
      return Number.isInteger(parsedId) ? parsedId : null;
    }
  }

  return null;
};

export const getAnilistIdFromFribb = async (
  tmdbId: number,
  type: "movie" | "tv",
) => findAnilistIdByTmdbId(await getFribbMapping(), tmdbId, type);
