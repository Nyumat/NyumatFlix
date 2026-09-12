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

export const normalizeFribbTmdbShowId = (
  value: FribbMappingItem["themoviedb_id"],
): number | null => {
  if (typeof value === "number") return value > 0 ? value : null;
  return firstPositiveId(value?.tv);
};

export const normalizeFribbTmdbId = firstPositiveId;

export const parseFribbAnimeList = (
  data: FribbMappingItem[],
): FribbAnimeRow[] =>
  data.filter(
    (item): item is FribbAnimeRow =>
      typeof item.anilist_id === "number" && item.anilist_id > 0,
  );

export const fribbTmdbSeasonNumberForRow = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

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
        fribbTmdbSeasonNumberForRow(row) === seasonNumber,
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
