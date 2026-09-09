import {
  animeSeasonNumberForEpisode,
  findSegmentForEpisode,
  relativeEpisodeInSegment,
  type MappingSegment,
} from "@/lib/anime/tmdb-anilist-map";

export type SegmentEpisodeCoords = {
  anilistId: number;
  relativeEpisodeNumber: number;
  animeSeasonNumber: number | null;
  segment: MappingSegment;
};

export const resolveSegmentEpisodeCoords = (input: {
  segments: readonly MappingSegment[];
  tmdbEpisodeNumber: number;
  anibridgeRelativeEpisode?: number | null;
}): SegmentEpisodeCoords | null => {
  const segment = findSegmentForEpisode(
    input.segments,
    input.tmdbEpisodeNumber,
  );
  if (!segment) {
    return null;
  }

  const relativeEpisodeNumber =
    input.anibridgeRelativeEpisode != null
      ? input.anibridgeRelativeEpisode
      : relativeEpisodeInSegment(segment, input.tmdbEpisodeNumber);

  return {
    anilistId: segment.anilistMediaId,
    relativeEpisodeNumber,
    animeSeasonNumber: animeSeasonNumberForEpisode(
      input.segments,
      input.tmdbEpisodeNumber,
    ),
    segment,
  };
};
