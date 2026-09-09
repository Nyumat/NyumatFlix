import {
  buildAniBridgeSeasonSegments,
  type AniBridgeSeasonMappings,
  collectAniBridgeTmdbSeasons,
} from "@/lib/anime/anibridge-season-segments";
import { extendMappingSegmentsWithKnownSpecialSequels } from "@/lib/anime/special-sequel-appendix";
import {
  appendMappingSegmentsBeyond,
  buildFribbSeasonSegments,
} from "@/lib/anime/split-cour-appendix";
import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";
import {
  fribbTmdbSeasonNumberForRow,
  normalizeFribbTmdbShowId,
  type FribbAnimeRow,
} from "@/lib/fribb-core";
import type {
  BundledSeasonSegmentSource,
  SeasonIndex,
  SeasonIndexEntry,
} from "@/lib/anime/season-index-types";
import { seasonIndexLookupKey } from "@/lib/anime/season-index-types";

export type SeasonSegmentSource =
  | BundledSeasonSegmentSource
  | "heuristic"
  | "empty";

export const mergeBundledSeasonSegments = (input: {
  mappings: AniBridgeSeasonMappings;
  fribbRows: readonly FribbAnimeRow[];
  tmdbShowId: number;
  seasonNumber: number;
  baseSegments?: MappingSegment[];
}): { segments: MappingSegment[]; source: SeasonSegmentSource } => {
  const anibridgeSegments = input.baseSegments
    ? []
    : buildAniBridgeSeasonSegments(
        input.mappings,
        input.tmdbShowId,
        input.seasonNumber,
      );

  let segments = input.baseSegments ?? anibridgeSegments;
  let source: SeasonSegmentSource = input.baseSegments
    ? "heuristic"
    : segments.length > 0
      ? "anibridge"
      : "empty";

  const fribbSegments = buildFribbSeasonSegments(
    input.fribbRows,
    input.tmdbShowId,
    input.seasonNumber,
  );

  if (segments.length === 0 && fribbSegments.length > 0) {
    segments = fribbSegments;
    source = "fribb";
  } else if (segments.length > 0) {
    segments = appendMappingSegmentsBeyond(segments, fribbSegments);
  }

  if (segments.length === 0) {
    return { segments, source };
  }

  return {
    segments: extendMappingSegmentsWithKnownSpecialSequels(segments),
    source,
  };
};

const collectFribbTmdbSeasons = (
  fribbRows: readonly FribbAnimeRow[],
): Array<{ tmdbShowId: number; seasonNumber: number }> => {
  const keys = new Set<string>();

  for (const row of fribbRows) {
    const tmdbShowId = normalizeFribbTmdbShowId(row.themoviedb_id);
    if (!tmdbShowId) continue;
    keys.add(
      seasonIndexLookupKey(tmdbShowId, fribbTmdbSeasonNumberForRow(row)),
    );
  }

  return [...keys].map((key) => {
    const [tmdbShowId, seasonNumber] = key.split(":");
    return {
      tmdbShowId: Number(tmdbShowId),
      seasonNumber: Number(seasonNumber),
    };
  });
};

export const buildSeasonIndex = (input: {
  mappings: AniBridgeSeasonMappings;
  fribbRows: readonly FribbAnimeRow[];
  generatedAt?: string;
}): SeasonIndex => {
  const seasonKeys = new Map<
    string,
    { tmdbShowId: number; seasonNumber: number }
  >();

  for (const season of collectAniBridgeTmdbSeasons(input.mappings)) {
    seasonKeys.set(
      seasonIndexLookupKey(season.tmdbShowId, season.seasonNumber),
      season,
    );
  }

  for (const season of collectFribbTmdbSeasons(input.fribbRows)) {
    seasonKeys.set(
      seasonIndexLookupKey(season.tmdbShowId, season.seasonNumber),
      season,
    );
  }

  const entries: Record<string, SeasonIndexEntry> = {};

  for (const { tmdbShowId, seasonNumber } of seasonKeys.values()) {
    const merged = mergeBundledSeasonSegments({
      mappings: input.mappings,
      fribbRows: input.fribbRows,
      tmdbShowId,
      seasonNumber,
    });

    if (
      merged.segments.length === 0 ||
      merged.source === "heuristic" ||
      merged.source === "empty"
    ) {
      continue;
    }

    entries[seasonIndexLookupKey(tmdbShowId, seasonNumber)] = {
      segments: merged.segments,
      source: merged.source,
    };
  }

  return {
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    entries,
  };
};
