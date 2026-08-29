import "server-only";

import {
  getAniBridgeMappings,
  resolveAniBridgePlaybackCoords,
  type AniBridgeSeasonMappings,
} from "@/lib/anime/anibridge-mappings";
import {
  episodeInMappingRange,
  parseMappingRange,
} from "@/lib/anime/mapping-ranges";
import { resolveAnilistMovieTmdbRoute } from "@/lib/anilist-movie-route";
import {
  getFribbAnimeList,
  resolveFribbPlaybackCoords,
  type FribbAnimeRow,
} from "@/lib/fribb-mapping";
import type { AnimeScrapeInput } from "./types";
import type { ScrapeMediaInput } from "../types";

export type AnimeSubtitleTmdbLookup = Pick<
  ScrapeMediaInput,
  "mediaType" | "tmdbId" | "seasonNumber" | "episodeNumber"
>;

const fribbTmdbSeasonNumber = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

const normalizeFribbTmdbShowId = (
  value: FribbAnimeRow["themoviedb_id"],
): number | null => {
  if (typeof value === "number") {
    return value > 0 ? value : null;
  }

  const tv = value?.tv;
  if (typeof tv === "number" && tv > 0) {
    return tv;
  }

  if (Array.isArray(tv)) {
    for (const entry of tv) {
      if (typeof entry === "number" && entry > 0) {
        return entry;
      }
    }
  }

  return null;
};

export const resolveFribbSubtitleTmdbLookup = (
  rows: readonly FribbAnimeRow[],
  anilistId: number,
  relativeEpisode: number,
): AnimeSubtitleTmdbLookup | null => {
  const animeRows = rows.filter((row) => row.anilist_id === anilistId);
  if (animeRows.length === 0) {
    return null;
  }

  for (const row of animeRows) {
    const tmdbShowId = normalizeFribbTmdbShowId(row.themoviedb_id);
    if (!tmdbShowId) {
      continue;
    }

    const seasonNumber = fribbTmdbSeasonNumber(row);
    const offset = row.episode_offset?.tmdb ?? 0;
    const tmdbEpisode = offset > 0 ? relativeEpisode + offset : relativeEpisode;
    const forward = resolveFribbPlaybackCoords(
      rows,
      tmdbShowId,
      seasonNumber,
      tmdbEpisode,
    );

    if (
      forward?.anilistId === anilistId &&
      forward.relativeEpisode === relativeEpisode
    ) {
      return {
        mediaType: "tv",
        tmdbId: tmdbShowId,
        seasonNumber,
        episodeNumber: tmdbEpisode,
      };
    }
  }

  return null;
};

export const resolveAniBridgeSubtitleTmdbLookup = (
  mappings: AniBridgeSeasonMappings,
  anilistId: number,
  relativeEpisode: number,
): AnimeSubtitleTmdbLookup | null => {
  for (const [seasonKey, entry] of Object.entries(mappings)) {
    const match = /^tmdb_show:(\d+):s(\d+)$/.exec(seasonKey);
    if (!match) {
      continue;
    }

    const tmdbShowId = Number(match[1]);
    const seasonNumber = Number(match[2]);
    if (!Number.isInteger(tmdbShowId) || !Number.isInteger(seasonNumber)) {
      continue;
    }

    const rangeMap = entry[`anilist:${anilistId}`];
    if (!rangeMap) {
      continue;
    }

    for (const [sourceRange, targetSpec] of Object.entries(rangeMap)) {
      const targetPart = targetSpec.split("|")[0]?.split(",")[0] ?? "";
      if (!episodeInMappingRange(relativeEpisode, targetPart)) {
        continue;
      }

      const source = parseMappingRange(sourceRange.replace(/-$/, ""));
      const target = parseMappingRange(targetPart.replace(/-$/, ""));
      if (!source || !target) {
        continue;
      }

      const tmdbEpisode = source.start + (relativeEpisode - target.start);
      const forward = resolveAniBridgePlaybackCoords(
        mappings,
        tmdbShowId,
        seasonNumber,
        tmdbEpisode,
      );

      if (
        forward?.anilistId === anilistId &&
        forward.relativeEpisode === relativeEpisode
      ) {
        return {
          mediaType: "tv",
          tmdbId: tmdbShowId,
          seasonNumber,
          episodeNumber: tmdbEpisode,
        };
      }
    }
  }

  return null;
};

export const resolveAnimeSubtitleTmdbLookup = async (
  input: Pick<AnimeScrapeInput, "anilistId" | "episodeNumber">,
): Promise<AnimeSubtitleTmdbLookup | null> => {
  const movieTmdbId = await resolveAnilistMovieTmdbRoute(input.anilistId);
  if (movieTmdbId) {
    return {
      mediaType: "movie",
      tmdbId: movieTmdbId,
    };
  }

  const fribbRows = await getFribbAnimeList();
  const fribbLookup = resolveFribbSubtitleTmdbLookup(
    fribbRows,
    input.anilistId,
    input.episodeNumber,
  );
  if (fribbLookup) {
    return fribbLookup;
  }

  const mappings = await getAniBridgeMappings();
  return resolveAniBridgeSubtitleTmdbLookup(
    mappings,
    input.anilistId,
    input.episodeNumber,
  );
};
