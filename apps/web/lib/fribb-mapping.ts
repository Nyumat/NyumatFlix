import "server-only";

import {
  FRIBB_BUNDLED_FILE,
  readBundledJson,
} from "@/lib/anime/bundled-mapping-files";
import {
  findAnilistIdByTmdbId,
  normalizeFribbTmdbShowId,
  normalizeFribbTmdbId,
  parseFribbAnimeList,
  resolveFribbPlaybackCoords,
  resolveFribbTmdbMapping,
  type FribbAnimeRow,
  type FribbMappingItem,
  type FribbTmdbEntry,
  type FribbTmdbMapping,
} from "@/lib/fribb-core";

export type {
  FribbAnimeRow,
  FribbMappingItem,
  FribbTmdbEntry,
  FribbTmdbMapping,
};
export {
  findAnilistIdByTmdbId,
  normalizeFribbTmdbShowId,
  normalizeFribbTmdbId,
  resolveFribbPlaybackCoords,
  resolveFribbTmdbMapping,
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
        ? normalizeFribbTmdbId(item.themoviedb_id.movie)
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

export const getTmdbIdFromFribb = async (
  anilistId: number,
  format?: string | null,
) => {
  const mapping = await getFribbMapping();
  return resolveFribbTmdbMapping(mapping?.[anilistId], format);
};

export const getAnilistIdFromFribb = async (
  tmdbId: number,
  type: "movie" | "tv",
) => findAnilistIdByTmdbId(await getFribbMapping(), tmdbId, type);
