import "server-only";

import {
  buildAniBridgeSeasonSegments,
  getAniBridgeMappings,
  resolveAniBridgeMalPlaybackTarget,
  resolveAniBridgePlaybackCoords,
} from "@/lib/anime/anibridge-mappings";
import { advanceFribbPlaybackAcrossSpecialSequels } from "@/lib/anime/split-cour-appendix";
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
import { requiresAdultAniListContent } from "@/lib/anilist";
import {
  fetchAnilistIdByMal,
  fetchAnilistMediaMeta,
} from "@/lib/scrape/anime/anilist-meta";
import { getCachedAnilistTvMedia } from "@/lib/anilist-tv-detail";

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
  isAdult: boolean;
  genres: string[];
};

const enrichCoordsWithAnilistMeta = async (
  coords: Omit<AnimePlaybackCoords, "isAdult" | "genres">,
): Promise<AnimePlaybackCoords> => {
  const meta = await fetchAnilistMediaMeta(coords.anilistId);
  const genres = meta?.genres ?? [];
  const isAdult = meta?.isAdult === true || requiresAdultAniListContent(genres);

  return {
    ...coords,
    isAdult,
    genres,
  };
};

const coordsFromSegment = (
  segment: MappingSegment,
  tmdbEpisodeNumber: number,
  segments: readonly MappingSegment[],
): Omit<AnimePlaybackCoords, "source" | "isAdult" | "genres"> => ({
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
      return enrichCoordsWithAnilistMeta({
        ...coords,
        relativeEpisodeNumber: anibridge.relativeEpisode,
        animeSeasonNumber: useTmdbSeasonDisplay
          ? input.seasonNumber
          : coords.animeSeasonNumber,
        source: "anibridge",
      });
    }

    return enrichCoordsWithAnilistMeta({
      anilistId: anibridge.anilistId,
      relativeEpisodeNumber: anibridge.relativeEpisode,
      animeSeasonNumber: useTmdbSeasonDisplay ? input.seasonNumber : 1,
      animeInfo: {
        anilistId: anibridge.anilistId,
        startEpisode: input.episodeNumber,
        endEpisode: input.episodeNumber,
      },
      source: "anibridge",
    });
  }

  const malTarget = resolveAniBridgeMalPlaybackTarget(
    mappings,
    input.tmdbShowId,
    input.seasonNumber,
    input.episodeNumber,
  );
  if (malTarget) {
    const anilistId = await fetchAnilistIdByMal(malTarget.malId);
    if (anilistId) {
      return enrichCoordsWithAnilistMeta({
        anilistId,
        relativeEpisodeNumber: malTarget.relativeEpisode,
        animeSeasonNumber: useTmdbSeasonDisplay ? input.seasonNumber : 1,
        animeInfo: {
          anilistId,
          startEpisode: input.episodeNumber,
          endEpisode: input.episodeNumber,
        },
        source: "anibridge",
      });
    }
  }

  const fribbRows = await getFribbAnimeList();
  const fribb = resolveFribbPlaybackCoords(
    fribbRows,
    input.tmdbShowId,
    input.seasonNumber,
    input.episodeNumber,
  );
  if (!fribb) return null;

  const baseMedia = await getCachedAnilistTvMedia(fribb.anilistId);
  const sequelNode = baseMedia?.relations?.edges?.find(
    (edge) =>
      edge.relationType === "SEQUEL" &&
      edge.node?.type === "ANIME" &&
      edge.node.format === "SPECIAL" &&
      typeof edge.node.id === "number" &&
      edge.node.id > 0,
  )?.node;
  const adjusted = advanceFribbPlaybackAcrossSpecialSequels({
    anilistId: fribb.anilistId,
    relativeEpisode: fribb.relativeEpisode,
    segmentStart: fribb.segmentStart,
    episodeCount: baseMedia?.episodes,
    sequelSpecialId: sequelNode?.id,
  });

  return enrichCoordsWithAnilistMeta({
    anilistId: adjusted.anilistId,
    relativeEpisodeNumber: adjusted.relativeEpisode,
    animeSeasonNumber: input.seasonNumber,
    animeInfo: {
      anilistId: adjusted.anilistId,
      startEpisode: adjusted.segmentStart,
      endEpisode: Number.MAX_SAFE_INTEGER,
    },
    source: "fribb",
  });
};
