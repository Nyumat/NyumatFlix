import "server-only";

import {
  buildAniBridgeSeasonSegments,
  getAniBridgeMappings,
  resolveAniBridgePlaybackCoords,
} from "@/lib/anime/anibridge-mappings";
import {
  animeSeasonNumberForEpisode,
  findSegmentForEpisode,
  relativeEpisodeInSegment,
  type MappingSegment,
} from "@/lib/anime/tmdb-anilist-map";
import {
  getFribbAnimeList,
  resolveFribbPlaybackCoords,
} from "@/lib/fribb-mapping";

export type AnimePlaybackCoords = {
  anilistId: number;
  relativeEpisodeNumber: number;
  animeSeasonNumber: number | null;
  animeInfo: {
    anilistId: number;
    startEpisode: number;
    endEpisode: number;
  };
  source: "anibridge" | "fribb";
};

const coordsFromSegment = (
  segment: MappingSegment,
  tmdbEpisodeNumber: number,
  segments: readonly MappingSegment[],
): Omit<AnimePlaybackCoords, "source"> => ({
  anilistId: segment.anilistMediaId,
  relativeEpisodeNumber: relativeEpisodeInSegment(segment, tmdbEpisodeNumber),
  animeSeasonNumber: animeSeasonNumberForEpisode(segments, tmdbEpisodeNumber),
  animeInfo: {
    anilistId: segment.anilistMediaId,
    startEpisode: segment.startEpisode,
    endEpisode: segment.endEpisode,
  },
});

export const resolveAnimePlaybackCoords = async (input: {
  tmdbShowId: number;
  seasonNumber: number;
  episodeNumber: number;
}): Promise<AnimePlaybackCoords | null> => {
  const mappings = await getAniBridgeMappings();
  const tmdbSeasonKeyPrefix = `tmdb_show:${input.tmdbShowId}:s`;
  const tmdbSeasonCount = Object.keys(mappings).filter(
    (key) =>
      key.startsWith(tmdbSeasonKeyPrefix) &&
      !key.endsWith(":s0") &&
      /^tmdb_show:\d+:s\d+$/.test(key),
  ).length;
  const useTmdbSeasonDisplay = tmdbSeasonCount > 1;

  const anibridge = resolveAniBridgePlaybackCoords(
    mappings,
    input.tmdbShowId,
    input.seasonNumber,
    input.episodeNumber,
  );

  if (anibridge) {
    const segments = buildAniBridgeSeasonSegments(
      mappings,
      input.tmdbShowId,
      input.seasonNumber,
    );
    const segment = findSegmentForEpisode(segments, input.episodeNumber);
    if (segment) {
      const coords = coordsFromSegment(segment, input.episodeNumber, segments);
      return {
        ...coords,
        relativeEpisodeNumber: anibridge.relativeEpisode,
        animeSeasonNumber: useTmdbSeasonDisplay
          ? input.seasonNumber
          : coords.animeSeasonNumber,
        source: "anibridge",
      };
    }

    return {
      anilistId: anibridge.anilistId,
      relativeEpisodeNumber: anibridge.relativeEpisode,
      animeSeasonNumber: useTmdbSeasonDisplay ? input.seasonNumber : 1,
      animeInfo: {
        anilistId: anibridge.anilistId,
        startEpisode: input.episodeNumber,
        endEpisode: input.episodeNumber,
      },
      source: "anibridge",
    };
  }

  const fribbRows = await getFribbAnimeList();
  const fribb = resolveFribbPlaybackCoords(
    fribbRows,
    input.tmdbShowId,
    input.seasonNumber,
    input.episodeNumber,
  );
  if (!fribb) return null;

  return {
    anilistId: fribb.anilistId,
    relativeEpisodeNumber: fribb.relativeEpisode,
    animeSeasonNumber: input.seasonNumber,
    animeInfo: {
      anilistId: fribb.anilistId,
      startEpisode: fribb.segmentStart,
      endEpisode: Number.MAX_SAFE_INTEGER,
    },
    source: "fribb",
  };
};
