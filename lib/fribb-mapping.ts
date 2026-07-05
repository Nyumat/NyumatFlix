import { unstable_cache } from "next/cache";

export type FribbMappingItem = {
  anilist_id?: number;
  themoviedb_id?: {
    tv?: number;
    movie?: number;
  };
};

export type FribbTmdbEntry = {
  tv?: number;
  movie?: number;
};

export type FribbTmdbMapping = {
  id: number;
  type: "movie" | "tv";
};

const FRIBB_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json";
const FRIBB_FETCH_TIMEOUT_MS = 8000;

/** Pick TV vs movie using AniList format when Fribb has both IDs. */
export const resolveFribbTmdbMapping = (
  entry: FribbTmdbEntry | undefined,
  format?: string | null,
): FribbTmdbMapping | null => {
  if (!entry) return null;

  if (format === "MOVIE" && entry.movie) {
    return { id: entry.movie, type: "movie" };
  }

  if (entry.tv) {
    return { id: entry.tv, type: "tv" };
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
      if (item.themoviedb_id.tv) entry.tv = item.themoviedb_id.tv;
      if (item.themoviedb_id.movie) entry.movie = item.themoviedb_id.movie;

      if (entry.tv || entry.movie) {
        mapping[item.anilist_id] = entry;
      }
    }

    return mapping;
  },
  ["fribb-anime-mapping-v3"],
  { revalidate: 60 * 60 * 24 },
);

export const getTmdbIdFromFribb = async (
  anilistId: number,
  format?: string | null,
) => {
  const mapping = await getFribbMapping();
  return resolveFribbTmdbMapping(mapping?.[anilistId], format);
};
