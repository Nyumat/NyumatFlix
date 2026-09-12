import "server-only";

import {
  countAniBridgeTmdbSeasons,
  type AniBridgeSeasonMappings,
} from "@/lib/anime/anibridge-season-segments";
import { getAniBridgeMappings } from "@/lib/anime/anibridge-mappings";
import { getSeasonIndex, getSeasonIndexEntry } from "@/lib/anime/season-index";
import { countIndexedTmdbSeasons } from "@/lib/anime/season-index-types";
import {
  mergeBundledSeasonSegments,
  type SeasonSegmentSource,
} from "@/lib/anime/season-segment-merge";
import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";
import { getFribbAnimeList } from "@/lib/fribb-mapping";

export type { SeasonSegmentSource };

export type ResolvedSeasonSegments = {
  segments: MappingSegment[];
  source: SeasonSegmentSource;
  useTmdbSeasonDisplay: boolean;
};

export { countAniBridgeTmdbSeasons };

const resolveUseTmdbSeasonDisplay = async (
  tmdbShowId: number,
  indexedSeasonCount: number | null,
): Promise<boolean> => {
  if (indexedSeasonCount != null) {
    return indexedSeasonCount > 1;
  }

  const mappings = await getAniBridgeMappings();
  return countAniBridgeTmdbSeasons(mappings, tmdbShowId) > 1;
};

const resolveBundledSeasonSegments = async (input: {
  mappings: AniBridgeSeasonMappings;
  tmdbShowId: number;
  seasonNumber: number;
  baseSegments?: MappingSegment[];
}): Promise<{ segments: MappingSegment[]; source: SeasonSegmentSource }> => {
  const fribbRows = await getFribbAnimeList();
  return mergeBundledSeasonSegments({
    mappings: input.mappings,
    fribbRows,
    tmdbShowId: input.tmdbShowId,
    seasonNumber: input.seasonNumber,
    baseSegments: input.baseSegments,
  });
};

export const resolveSeasonSegments = async (input: {
  tmdbShowId: number;
  seasonNumber: number;
  baseSegments?: MappingSegment[];
}): Promise<ResolvedSeasonSegments> => {
  if (!input.baseSegments) {
    const [index, indexed] = await Promise.all([
      getSeasonIndex(),
      getSeasonIndexEntry({
        tmdbShowId: input.tmdbShowId,
        seasonNumber: input.seasonNumber,
      }),
    ]);

    if (indexed) {
      const indexedSeasonCount =
        index && index.version === 1
          ? countIndexedTmdbSeasons(index, input.tmdbShowId)
          : null;

      return {
        segments: indexed.segments,
        source: indexed.source,
        useTmdbSeasonDisplay: await resolveUseTmdbSeasonDisplay(
          input.tmdbShowId,
          indexedSeasonCount,
        ),
      };
    }
  }

  const mappings = await getAniBridgeMappings();
  const merged = await resolveBundledSeasonSegments({
    mappings,
    tmdbShowId: input.tmdbShowId,
    seasonNumber: input.seasonNumber,
    baseSegments: input.baseSegments,
  });

  return {
    segments: merged.segments,
    source: merged.source,
    useTmdbSeasonDisplay: await resolveUseTmdbSeasonDisplay(
      input.tmdbShowId,
      null,
    ),
  };
};

/** @deprecated Use resolveSeasonSegments instead. */
export const extendSeasonMapSegments = async (
  segments: MappingSegment[],
  tmdbShowId: number,
  seasonNumber: number,
): Promise<MappingSegment[]> => {
  const resolved = await resolveSeasonSegments({
    tmdbShowId,
    seasonNumber,
    baseSegments: segments,
  });
  return resolved.segments;
};
