import {
  episodeInMappingRange,
  mapEpisodeAcrossRanges,
  parseMappingRange,
} from "@/lib/anime/mapping-ranges";
import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";

export type AniBridgeSeasonMappings = Record<
  string,
  Record<string, Record<string, string>>
>;

export const anibridgeTmdbSeasonKey = (
  tmdbShowId: number,
  seasonNumber: number,
): string => `tmdb_show:${tmdbShowId}:s${seasonNumber}`;

export const countAniBridgeTmdbSeasons = (
  mappings: AniBridgeSeasonMappings,
  tmdbShowId: number,
): number => {
  const tmdbSeasonKeyPrefix = `tmdb_show:${tmdbShowId}:s`;
  return Object.keys(mappings).filter(
    (key) =>
      key.startsWith(tmdbSeasonKeyPrefix) &&
      !key.endsWith(":s0") &&
      /^tmdb_show:\d+:s\d+$/.test(key),
  ).length;
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

export const resolveAniBridgeMalPlaybackTarget = (
  mappings: AniBridgeSeasonMappings,
  tmdbShowId: number,
  seasonNumber: number,
  episodeNumber: number,
): { malId: number; relativeEpisode: number } | null => {
  const entry = mappings[anibridgeTmdbSeasonKey(tmdbShowId, seasonNumber)];
  if (!entry) return null;

  for (const [target, rangeMap] of Object.entries(entry)) {
    if (!target.startsWith("mal:")) continue;

    const malId = Number(target.split(":")[1]);
    if (!Number.isInteger(malId) || malId <= 0) continue;

    const relativeEpisode = mapEpisodeAcrossRanges(episodeNumber, rangeMap);
    if (relativeEpisode != null) {
      return { malId, relativeEpisode };
    }
  }

  return null;
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

const TMDB_SHOW_SEASON_KEY = /^tmdb_show:(\d+):s(\d+)$/;
const ANILIST_DESCRIPTOR_KEY = /^anilist:(\d+)$/;

export const parseAniBridgeTmdbShowSeasonKey = (
  key: string,
): { tmdbShowId: number; seasonNumber: number } | null => {
  const match = TMDB_SHOW_SEASON_KEY.exec(key);
  if (!match) return null;

  const tmdbShowId = Number(match[1]);
  const seasonNumber = Number(match[2]);
  if (!Number.isInteger(tmdbShowId) || tmdbShowId <= 0) return null;
  if (!Number.isInteger(seasonNumber) || seasonNumber < 0) return null;

  return { tmdbShowId, seasonNumber };
};

export const parseAniBridgeAnilistKey = (key: string): number | null => {
  const match = ANILIST_DESCRIPTOR_KEY.exec(key);
  if (!match) return null;

  const anilistId = Number(match[1]);
  return Number.isInteger(anilistId) && anilistId > 0 ? anilistId : null;
};

const firstAnilistIdInEntry = (
  entry: Record<string, Record<string, string>> | undefined,
): number | null => {
  if (!entry) return null;

  for (const target of Object.keys(entry)) {
    const anilistId = parseAniBridgeAnilistKey(target);
    if (anilistId) return anilistId;
  }

  return null;
};

export const collectAniBridgeTmdbSeasons = (
  mappings: AniBridgeSeasonMappings,
): Array<{ tmdbShowId: number; seasonNumber: number }> => {
  const seasons: Array<{ tmdbShowId: number; seasonNumber: number }> = [];

  for (const key of Object.keys(mappings)) {
    const parsed = parseAniBridgeTmdbShowSeasonKey(key);
    if (!parsed || parsed.seasonNumber === 0) continue;

    seasons.push(parsed);
  }

  return seasons;
};

export const collectAniBridgeAnilistIdsForTmdbShow = (
  mappings: AniBridgeSeasonMappings,
  tmdbShowId: number,
): number[] => {
  const seasons = collectAniBridgeTmdbSeasons(mappings)
    .filter((season) => season.tmdbShowId === tmdbShowId)
    .sort((left, right) => left.seasonNumber - right.seasonNumber);

  const ids: number[] = [];
  for (const season of seasons) {
    const entry =
      mappings[anibridgeTmdbSeasonKey(tmdbShowId, season.seasonNumber)];
    if (!entry) continue;

    for (const target of Object.keys(entry)) {
      const anilistId = parseAniBridgeAnilistKey(target);
      if (anilistId && !ids.includes(anilistId)) {
        ids.push(anilistId);
      }
    }
  }

  return ids;
};

export const resolveAniBridgeAnilistIdForTmdbShow = (
  mappings: AniBridgeSeasonMappings,
  tmdbShowId: number,
  seasonNumber?: number | null,
): number | null => {
  const seasonsToTry: number[] = [];
  if (
    typeof seasonNumber === "number" &&
    Number.isInteger(seasonNumber) &&
    seasonNumber > 0
  ) {
    seasonsToTry.push(seasonNumber);
  }
  if (!seasonsToTry.includes(1)) {
    seasonsToTry.push(1);
  }

  for (const season of seasonsToTry) {
    const fromEpisodeOne = resolveAniBridgePlaybackCoords(
      mappings,
      tmdbShowId,
      season,
      1,
    );
    if (fromEpisodeOne?.anilistId) return fromEpisodeOne.anilistId;

    const fromEntry = firstAnilistIdInEntry(
      mappings[anibridgeTmdbSeasonKey(tmdbShowId, season)],
    );
    if (fromEntry) return fromEntry;
  }

  const remainingSeasons = collectAniBridgeTmdbSeasons(mappings)
    .filter(
      (season) =>
        season.tmdbShowId === tmdbShowId &&
        !seasonsToTry.includes(season.seasonNumber),
    )
    .sort((left, right) => left.seasonNumber - right.seasonNumber);

  for (const season of remainingSeasons) {
    const fromEpisodeOne = resolveAniBridgePlaybackCoords(
      mappings,
      tmdbShowId,
      season.seasonNumber,
      1,
    );
    if (fromEpisodeOne?.anilistId) return fromEpisodeOne.anilistId;

    const fromEntry = firstAnilistIdInEntry(
      mappings[anibridgeTmdbSeasonKey(tmdbShowId, season.seasonNumber)],
    );
    if (fromEntry) return fromEntry;
  }

  return null;
};

export const resolveAniBridgeTmdbShowIdForAnilist = (
  mappings: AniBridgeSeasonMappings,
  anilistId: number,
): { tmdbShowId: number; seasonNumber: number } | null => {
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return null;
  }

  const anilistKey = `anilist:${anilistId}`;
  const reverseEntry = mappings[anilistKey];
  if (reverseEntry) {
    const fromReverse = Object.keys(reverseEntry)
      .map(parseAniBridgeTmdbShowSeasonKey)
      .filter(
        (parsed): parsed is { tmdbShowId: number; seasonNumber: number } =>
          parsed != null && parsed.seasonNumber > 0,
      )
      .sort((left, right) => left.seasonNumber - right.seasonNumber);
    if (fromReverse[0]) return fromReverse[0];
  }

  let best: { tmdbShowId: number; seasonNumber: number } | null = null;
  const anilistTarget = `anilist:${anilistId}`;

  for (const [key, targets] of Object.entries(mappings)) {
    if (!targets[anilistTarget]) continue;

    const parsed = parseAniBridgeTmdbShowSeasonKey(key);
    if (!parsed || parsed.seasonNumber === 0) continue;

    if (!best || parsed.seasonNumber < best.seasonNumber) {
      best = parsed;
    }
  }

  return best;
};
