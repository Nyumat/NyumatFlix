export type MappingSegment = {
  startEpisode: number;
  endEpisode: number;
  anilistMediaId: number;
};

export const buildUnknownEpisodeCountSegment = (input: {
  anilistMediaId: number;
  tmdbEpisodeCount: number;
  tmdbEpisodeNumbers: readonly number[];
}): MappingSegment => {
  const lastPositiveEpisodeNumber = Math.max(
    0,
    ...input.tmdbEpisodeNumbers.filter(
      (episodeNumber) => Number.isInteger(episodeNumber) && episodeNumber > 0,
    ),
  );

  return {
    startEpisode: 1,
    endEpisode: Math.max(input.tmdbEpisodeCount, lastPositiveEpisodeNumber),
    anilistMediaId: input.anilistMediaId,
  };
};

export type MappingConfidence = "high" | "low";

export type TmdbAnilistMapResponse = {
  tmdbShowId: number;
  tmdbSeason?: number;
  segments: MappingSegment[];
  confidence: MappingConfidence;
  isAdult: boolean;
  source?: string;
};

export const findSegmentForEpisode = (
  segments: readonly MappingSegment[],
  tmdbEpisodeNumber: number,
): MappingSegment | null => {
  for (const segment of segments) {
    if (
      tmdbEpisodeNumber >= segment.startEpisode &&
      tmdbEpisodeNumber <= segment.endEpisode
    ) {
      return segment;
    }
  }

  return null;
};

export const relativeEpisodeInSegment = (
  segment: MappingSegment,
  tmdbEpisodeNumber: number,
): number => tmdbEpisodeNumber - segment.startEpisode + 1;

/** 1-based anime season index from AniList segments (not TMDB season_number). */
export const animeSeasonNumberForEpisode = (
  segments: readonly MappingSegment[],
  tmdbEpisodeNumber: number,
): number | null => {
  const index = segments.findIndex(
    (segment) =>
      tmdbEpisodeNumber >= segment.startEpisode &&
      tmdbEpisodeNumber <= segment.endEpisode,
  );
  return index >= 0 ? index + 1 : null;
};

export const toAnimeDisplayCoords = (
  segments: readonly MappingSegment[],
  tmdbEpisodeNumber: number,
): { seasonNumber: number; episodeNumber: number } | null => {
  const segment = findSegmentForEpisode(segments, tmdbEpisodeNumber);
  const seasonNumber = animeSeasonNumberForEpisode(segments, tmdbEpisodeNumber);
  if (!segment || seasonNumber == null) {
    return null;
  }

  return {
    seasonNumber,
    episodeNumber: relativeEpisodeInSegment(segment, tmdbEpisodeNumber),
  };
};

export const inferMappingConfidence = (
  segments: readonly MappingSegment[],
  candidateCount: number,
  sourceAnilistId?: number | null,
): MappingConfidence => {
  if (segments.length === 0 || candidateCount === 0) {
    return "low";
  }

  if (sourceAnilistId) {
    const usesSource = segments.some(
      (segment) => segment.anilistMediaId === sourceAnilistId,
    );
    if (usesSource) {
      return "high";
    }
  }

  if (candidateCount === 1 && segments.length === 1) {
    return "high";
  }

  if (segments.length > 1) {
    return "high";
  }

  return "low";
};

export type ResolvedAnimeEpisodeCoords = {
  anilistId: number;
  relativeEpisodeNumber: number;
  /** 1-based index among mapping segments when multi-cour TMDB seasons are split. */
  animeSeasonNumber: number | null;
  animeInfo: {
    anilistId: number;
    startEpisode: number;
    endEpisode: number;
  };
  confidence: MappingConfidence;
};

export const resolveAnimeEpisodeCoords = (input: {
  segments: readonly MappingSegment[];
  tmdbEpisodeNumber: number;
  fallbackAnilistId: number;
  confidence: MappingConfidence;
}): ResolvedAnimeEpisodeCoords => {
  const segment = findSegmentForEpisode(
    input.segments,
    input.tmdbEpisodeNumber,
  );

  if (segment) {
    return {
      anilistId: segment.anilistMediaId,
      relativeEpisodeNumber: relativeEpisodeInSegment(
        segment,
        input.tmdbEpisodeNumber,
      ),
      animeSeasonNumber: animeSeasonNumberForEpisode(
        input.segments,
        input.tmdbEpisodeNumber,
      ),
      animeInfo: {
        anilistId: segment.anilistMediaId,
        startEpisode: segment.startEpisode,
        endEpisode: segment.endEpisode,
      },
      confidence: input.confidence,
    };
  }

  return {
    anilistId: input.fallbackAnilistId,
    relativeEpisodeNumber: input.tmdbEpisodeNumber,
    animeSeasonNumber: null,
    animeInfo: {
      anilistId: input.fallbackAnilistId,
      startEpisode: 1,
      endEpisode: Number.MAX_SAFE_INTEGER,
    },
    confidence: "low",
  };
};
