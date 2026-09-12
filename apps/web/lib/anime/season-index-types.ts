import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";

export const SEASON_INDEX_VERSION = 1 as const;

export type BundledSeasonSegmentSource = "anibridge" | "fribb";

export type SeasonIndexEntry = {
  segments: MappingSegment[];
  source: BundledSeasonSegmentSource;
};

export type SeasonIndex = {
  version: typeof SEASON_INDEX_VERSION;
  generatedAt: string;
  entries: Record<string, SeasonIndexEntry>;
};

export const seasonIndexLookupKey = (
  tmdbShowId: number,
  seasonNumber: number,
): string => `${tmdbShowId}:${seasonNumber}`;

export const countIndexedTmdbSeasons = (
  index: SeasonIndex,
  tmdbShowId: number,
): number => {
  const prefix = `${tmdbShowId}:`;
  return Object.keys(index.entries).filter((key) => key.startsWith(prefix))
    .length;
};
