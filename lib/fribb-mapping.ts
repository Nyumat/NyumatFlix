import { unstable_cache } from "next/cache";

export type FribbMappingItem = {
  anilist_id?: number;
  themoviedb_id?: {
    tv?: number | number[];
    movie?: number | number[];
  };
  season?: {
    tmdb?: number;
  };
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

export const getFribbMapping = unstable_cache(
  async () => {
    const res = await fetch(FRIBB_URL, {
      signal: AbortSignal.timeout(FRIBB_FETCH_TIMEOUT_MS),
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) {
      throw new Error(`Fribb mapping fetch failed with status ${res.status}`);
    }

    const data: FribbMappingItem[] = await res.json();

    const mapping: Record<number, FribbTmdbEntry> = {};

    for (const item of data) {
      if (!item.anilist_id || !item.themoviedb_id) continue;

      const entry: FribbTmdbEntry = {};
      const tvId = firstPositiveId(item.themoviedb_id.tv);
      const movieId = firstPositiveId(item.themoviedb_id.movie);
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
  },
  ["fribb-anime-mapping-v4"],
  { revalidate: 60 * 60 * 24 },
);

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
