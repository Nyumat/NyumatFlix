import "server-only";

import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";
import {
  episodeInMappingRange,
  mapEpisodeAcrossRanges,
  parseMappingRange,
} from "@/lib/anime/mapping-ranges";

const ANIBRIDGE_URL =
  "https://github.com/anibridge/anibridge-mappings/releases/download/v3/mappings.min.json";
const FETCH_TIMEOUT_MS = 30_000;
const MEMORY_TTL_MS = 60 * 60 * 24 * 1000;

export type AniBridgeSeasonMappings = Record<
  string,
  Record<string, Record<string, string>>
>;

type CachedMappings = {
  value: AniBridgeSeasonMappings;
  expiresAt: number;
};

let cachedMappings: CachedMappings | null = null;
let inflightMappings: Promise<AniBridgeSeasonMappings> | null = null;

const loadAniBridgeMappings = async (): Promise<AniBridgeSeasonMappings> => {
  const response = await fetch(ANIBRIDGE_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(`AniBridge mappings fetch failed: ${response.status}`);
  }

  return (await response.json()) as AniBridgeSeasonMappings;
};

export const getAniBridgeMappings =
  async (): Promise<AniBridgeSeasonMappings> => {
    const now = Date.now();
    if (cachedMappings && cachedMappings.expiresAt > now) {
      return cachedMappings.value;
    }

    if (!inflightMappings) {
      inflightMappings = loadAniBridgeMappings()
        .then((value) => {
          cachedMappings = { value, expiresAt: Date.now() + MEMORY_TTL_MS };
          return value;
        })
        .finally(() => {
          inflightMappings = null;
        });
    }

    return inflightMappings;
  };

export const anibridgeTmdbSeasonKey = (
  tmdbShowId: number,
  seasonNumber: number,
): string => `tmdb_show:${tmdbShowId}:s${seasonNumber}`;

export const resolveAniBridgePlaybackCoords = (
  mappings: AniBridgeSeasonMappings,
  tmdbShowId: number,
  seasonNumber: number,
  episodeNumber: number,
): { anilistId: number; relativeEpisode: number } | null => {
  const entry = mappings[anibridgeTmdbSeasonKey(tmdbShowId, seasonNumber)];
  if (!entry) return null;

  for (const [target, rangeMap] of Object.entries(entry)) {
    if (!target.startsWith("anilist:")) continue;

    const anilistId = Number(target.split(":")[1]);
    if (!Number.isInteger(anilistId) || anilistId <= 0) continue;

    const relativeEpisode = mapEpisodeAcrossRanges(episodeNumber, rangeMap);
    if (relativeEpisode != null) {
      return { anilistId, relativeEpisode };
    }
  }

  return null;
};

export const buildAniBridgeSeasonSegments = (
  mappings: AniBridgeSeasonMappings,
  tmdbShowId: number,
  seasonNumber: number,
): MappingSegment[] => {
  const entry = mappings[anibridgeTmdbSeasonKey(tmdbShowId, seasonNumber)];
  if (!entry) return [];

  const segments: MappingSegment[] = [];

  for (const [target, rangeMap] of Object.entries(entry)) {
    if (!target.startsWith("anilist:")) continue;

    const anilistId = Number(target.split(":")[1]);
    if (!Number.isInteger(anilistId) || anilistId <= 0) continue;

    for (const sourceRange of Object.keys(rangeMap)) {
      const parsed = parseMappingRange(sourceRange.replace(/-$/, ""));
      if (!parsed) continue;

      const openEnded =
        sourceRange.trim().endsWith("-") &&
        !/\d+-\d+-$/.test(sourceRange.trim());

      segments.push({
        startEpisode: parsed.start,
        endEpisode: openEnded
          ? Number.MAX_SAFE_INTEGER
          : (parsed.end ?? parsed.start),
        anilistMediaId: anilistId,
      });
    }
  }

  return segments.sort((a, b) => a.startEpisode - b.startEpisode);
};

export const episodeMatchesAniBridgeSeason = (
  mappings: AniBridgeSeasonMappings,
  tmdbShowId: number,
  seasonNumber: number,
  episodeNumber: number,
): boolean => {
  const entry = mappings[anibridgeTmdbSeasonKey(tmdbShowId, seasonNumber)];
  if (!entry) return false;

  return Object.values(entry).some((rangeMap) =>
    Object.keys(rangeMap).some((sourceRange) =>
      episodeInMappingRange(episodeNumber, sourceRange),
    ),
  );
};
