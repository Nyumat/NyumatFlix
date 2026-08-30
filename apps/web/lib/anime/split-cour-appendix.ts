import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";
import type { FribbAnimeRow } from "@/lib/fribb-mapping";
import { normalizeFribbTmdbShowId } from "@/lib/fribb-mapping";

export const fribbTmdbSeasonNumberForRow = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

export const collectFribbAnilistIdsForTmdbSeason = (
  fribbRows: readonly FribbAnimeRow[],
  tmdbShowId: number,
  seasonNumber: number,
): number[] =>
  fribbRows
    .filter(
      (row) =>
        normalizeFribbTmdbShowId(row.themoviedb_id) === tmdbShowId &&
        fribbTmdbSeasonNumberForRow(row) === seasonNumber,
    )
    .sort((left, right) => {
      const offsetDiff =
        (left.episode_offset?.tmdb ?? 0) - (right.episode_offset?.tmdb ?? 0);
      if (offsetDiff !== 0) return offsetDiff;
      return left.anilist_id - right.anilist_id;
    })
    .map((row) => row.anilist_id);

export const mergeAnilistIdsByFribbOffset = (
  franchiseIds: readonly number[],
  fribbIds: readonly number[],
  fribbRows: readonly FribbAnimeRow[],
): number[] => {
  const merged = [...new Set([...franchiseIds, ...fribbIds])];
  const offsetFor = (anilistId: number): number =>
    fribbRows.find((row) => row.anilist_id === anilistId)?.episode_offset
      ?.tmdb ?? 0;

  return merged.sort(
    (left, right) => offsetFor(left) - offsetFor(right) || left - right,
  );
};

export const hasFribbSplitCourForTmdbSeason = (
  fribbRows: readonly FribbAnimeRow[],
  tmdbShowId: number,
  seasonNumber: number,
): boolean =>
  collectFribbAnilistIdsForTmdbSeason(fribbRows, tmdbShowId, seasonNumber)
    .length > 1;

export const buildFribbSeasonSegments = (
  fribbRows: readonly FribbAnimeRow[],
  tmdbShowId: number,
  seasonNumber: number,
): MappingSegment[] => {
  const anilistIds = collectFribbAnilistIdsForTmdbSeason(
    fribbRows,
    tmdbShowId,
    seasonNumber,
  );
  const seasonRows = fribbRows
    .filter((row) => anilistIds.includes(row.anilist_id))
    .sort(
      (left, right) =>
        (left.episode_offset?.tmdb ?? 0) - (right.episode_offset?.tmdb ?? 0),
    );

  const segments: MappingSegment[] = [];

  for (let index = 0; index < seasonRows.length; index += 1) {
    const row = seasonRows[index]!;
    const offset = row.episode_offset?.tmdb ?? 0;
    const startEpisode =
      offset > 0
        ? offset + 1
        : segments.length > 0
          ? segments[segments.length - 1]!.endEpisode + 1
          : 1;
    const nextOffset = seasonRows[index + 1]?.episode_offset?.tmdb;
    const endEpisode =
      nextOffset != null && nextOffset > offset ? nextOffset : startEpisode;

    segments.push({
      startEpisode,
      endEpisode,
      anilistMediaId: row.anilist_id,
    });
  }

  return segments;
};

export const appendMappingSegmentsBeyond = (
  base: readonly MappingSegment[],
  appendix: readonly MappingSegment[],
): MappingSegment[] => {
  if (appendix.length === 0) {
    return [...base];
  }

  const coveredEnd =
    base.length > 0
      ? Math.max(...base.map((segment) => segment.endEpisode))
      : 0;

  const merged = [...base];
  for (const segment of appendix) {
    if (segment.startEpisode > coveredEnd) {
      merged.push(segment);
    }
  }

  return merged.sort((left, right) => left.startEpisode - right.startEpisode);
};

export const advanceFribbPlaybackAcrossSpecialSequels = (input: {
  anilistId: number;
  relativeEpisode: number;
  segmentStart: number;
  episodeCount: number | null | undefined;
  sequelSpecialId: number | null | undefined;
}): {
  anilistId: number;
  relativeEpisode: number;
  segmentStart: number;
} => {
  const episodeCount =
    typeof input.episodeCount === "number" && input.episodeCount > 0
      ? input.episodeCount
      : 1;

  if (
    input.relativeEpisode <= episodeCount ||
    !input.sequelSpecialId ||
    input.sequelSpecialId <= 0
  ) {
    return {
      anilistId: input.anilistId,
      relativeEpisode: input.relativeEpisode,
      segmentStart: input.segmentStart,
    };
  }

  return {
    anilistId: input.sequelSpecialId,
    relativeEpisode: input.relativeEpisode - episodeCount,
    segmentStart: input.segmentStart + episodeCount,
  };
};
