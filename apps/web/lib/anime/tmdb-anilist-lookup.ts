import type { AniBridgeSeasonMappings } from "@/lib/anime/anibridge-season-segments";
import type { FribbAnimeRow } from "@/lib/fribb-core";
import {
  normalizeFribbTmdbId,
  normalizeFribbTmdbShowId,
} from "@/lib/fribb-core";

export const TMDB_ANILIST_LOOKUP_VERSION = 1 as const;

export const TMDB_ANILIST_LOOKUP_FILE = "tmdb-anilist-lookup.json";

export type TmdbAnilistLookup = {
  version: typeof TMDB_ANILIST_LOOKUP_VERSION;
  generatedAt: string;
  /** `tv:{tmdbShowId}:s{seasonNumber}` -> AniList id (season-specific first). */
  tv: Record<string, number>;
  /** `{tmdbMovieId}` -> AniList id. */
  movie: Record<string, number>;
};

export const tmdbAnilistLookupTvKey = (
  tmdbShowId: number,
  seasonNumber: number,
): string => `tv:${tmdbShowId}:s${seasonNumber}`;

export const tmdbAnilistLookupMovieKey = (tmdbMovieId: number): string =>
  String(tmdbMovieId);

const ANILIST_KEY_PATTERN = /^anilist:(\d+)$/;

const firstAnilistIdInTargets = (
  targets: Record<string, unknown> | undefined,
): number | null => {
  if (!targets) return null;
  for (const target of Object.keys(targets)) {
    const match = ANILIST_KEY_PATTERN.exec(target);
    if (!match?.[1]) continue;
    const anilistId = Number.parseInt(match[1], 10);
    if (Number.isInteger(anilistId) && anilistId > 0) return anilistId;
  }
  return null;
};

const TMDB_SHOW_SEASON_PATTERN = /^tmdb_show:(\d+):s(\d+)$/;

const collectAniBridgeTvEntries = (
  mappings: AniBridgeSeasonMappings,
): Array<{ tmdbShowId: number; seasonNumber: number; anilistId: number }> => {
  const entries: Array<{
    tmdbShowId: number;
    seasonNumber: number;
    anilistId: number;
  }> = [];

  for (const [key, targets] of Object.entries(mappings)) {
    const match = TMDB_SHOW_SEASON_PATTERN.exec(key);
    if (!match?.[1] || !match[2]) continue;
    const tmdbShowId = Number.parseInt(match[1], 10);
    const seasonNumber = Number.parseInt(match[2], 10);
    if (
      !Number.isInteger(tmdbShowId) ||
      tmdbShowId <= 0 ||
      !Number.isInteger(seasonNumber) ||
      seasonNumber <= 0
    ) {
      continue;
    }
    const anilistId = firstAnilistIdInTargets(
      targets as Record<string, unknown>,
    );
    if (anilistId) entries.push({ tmdbShowId, seasonNumber, anilistId });
  }

  return entries;
};

const fribbTvSeasonNumber = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (typeof season !== "number" || !Number.isInteger(season) || season <= 0) {
    return 1;
  }
  return season;
};

/**
 * Builds a flat O(1) TMDB -> AniList lookup so detail pages and catalog rows
 * never need the 14MB AniBridge/Fribb graphs or live AniList search on the
 * hot path. Precedence mirrors `resolveTmdbShowToAnilistId` (without the
 * live-search fallback): overrides > AniBridge > Fribb > MAL index.
 */
export const buildTmdbAnilistLookup = (input: {
  mappings: AniBridgeSeasonMappings;
  fribbRows: readonly FribbAnimeRow[];
  tmdbToAnilistFromMalIndex?: ReadonlyMap<string, number>;
  overrides?: Readonly<Record<number, number>>;
  generatedAt?: string;
}): TmdbAnilistLookup => {
  const tv: Record<string, number> = {};
  const movie: Record<string, number> = {};

  for (const entry of collectAniBridgeTvEntries(input.mappings)) {
    const key = tmdbAnilistLookupTvKey(entry.tmdbShowId, entry.seasonNumber);
    tv[key] ??= entry.anilistId;
  }

  for (const row of input.fribbRows) {
    if (
      typeof row.anilist_id !== "number" ||
      !Number.isInteger(row.anilist_id) ||
      row.anilist_id <= 0
    ) {
      continue;
    }
    const tvId = normalizeFribbTmdbShowId(row.themoviedb_id);
    if (tvId) {
      const key = tmdbAnilistLookupTvKey(tvId, fribbTvSeasonNumber(row));
      tv[key] ??= row.anilist_id;
    }
    const movieId = normalizeFribbTmdbId(
      typeof row.themoviedb_id === "object"
        ? (row.themoviedb_id.movie ?? undefined)
        : undefined,
    );
    if (movieId) {
      const key = tmdbAnilistLookupMovieKey(movieId);
      movie[key] ??= row.anilist_id;
    }
  }

  if (input.tmdbToAnilistFromMalIndex) {
    for (const [key, anilistId] of input.tmdbToAnilistFromMalIndex) {
      if (!Number.isInteger(anilistId) || anilistId <= 0) continue;
      const match = key.match(/^(movie|tv):(\d+)(?::(\d+))?$/);
      if (!match?.[1] || !match[2]) continue;
      const mediaType = match[1];
      const tmdbId = Number.parseInt(match[2], 10);
      if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;
      if (mediaType === "movie") {
        const lookupKey = tmdbAnilistLookupMovieKey(tmdbId);
        movie[lookupKey] ??= anilistId;
      } else {
        const season = match[3] ? Number.parseInt(match[3], 10) : 1;
        const lookupKey = tmdbAnilistLookupTvKey(
          tmdbId,
          Number.isInteger(season) && season > 0 ? season : 1,
        );
        tv[lookupKey] ??= anilistId;
      }
    }
  }

  if (input.overrides) {
    for (const [tmdbIdRaw, anilistId] of Object.entries(input.overrides)) {
      const tmdbId = Number.parseInt(tmdbIdRaw, 10);
      if (
        !Number.isInteger(tmdbId) ||
        tmdbId <= 0 ||
        typeof anilistId !== "number" ||
        !Number.isInteger(anilistId) ||
        anilistId <= 0
      ) {
        continue;
      }
      tv[tmdbAnilistLookupTvKey(tmdbId, 1)] = anilistId;
    }
  }

  return {
    version: TMDB_ANILIST_LOOKUP_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    tv,
    movie,
  };
};
