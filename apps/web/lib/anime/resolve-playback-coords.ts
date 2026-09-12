import "server-only";

import {
  getAniBridgeMappings,
  resolveAniBridgeMalPlaybackTarget,
  resolveAniBridgePlaybackCoords,
} from "@/lib/anime/anibridge-mappings";
import { advanceFribbPlaybackAcrossSpecialSequels } from "@/lib/anime/split-cour-appendix";
import { getKnownSpecialSequelIds } from "@/lib/anime/special-sequel-appendix";
import { resolveAnilistToTmdbShow } from "@/lib/anime/cross-id-resolver";
import { resolveSeasonSegments } from "@/lib/anime/resolve-season-segments";
import { resolveSegmentEpisodeCoords } from "@/lib/anime/resolve-segment-episode-coords";
import {
  getFribbAnimeList,
  resolveFribbPlaybackCoords,
} from "@/lib/fribb-mapping";
import { requiresAdultAniListContent } from "@/lib/anilist";
import {
  fetchAnilistIdByMal,
  fetchAnilistMediaMeta,
  peekAnilistMediaMeta,
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
  source: "anibridge" | "fribb" | "anilist";
  isAdult: boolean;
  genres: string[];
};

const enrichCoordsWithAnilistMeta = async (
  coords: Omit<AnimePlaybackCoords, "isAdult" | "genres">,
): Promise<AnimePlaybackCoords> => {
  const cached = peekAnilistMediaMeta(coords.anilistId);
  if (cached) {
    return {
      ...coords,
      isAdult:
        cached.isAdult === true || requiresAdultAniListContent(cached.genres),
      genres: cached.genres,
    };
  }

  void fetchAnilistMediaMeta(coords.anilistId);

  return {
    ...coords,
    isAdult: false,
    genres: [],
  };
};

const applySpecialSequelAdvance = async (input: {
  anilistId: number;
  relativeEpisode: number;
  segmentStart: number;
}): Promise<{
  anilistId: number;
  relativeEpisode: number;
  segmentStart: number;
}> => {
  const knownSequelId = getKnownSpecialSequelIds(input.anilistId)[0];
  if (knownSequelId) {
    return advanceFribbPlaybackAcrossSpecialSequels({
      anilistId: input.anilistId,
      relativeEpisode: input.relativeEpisode,
      segmentStart: input.segmentStart,
      episodeCount: peekAnilistMediaMeta(input.anilistId)?.episodes,
      sequelSpecialId: knownSequelId,
    });
  }

  const baseMedia = await getCachedAnilistTvMedia(input.anilistId);
  const sequelNode = baseMedia?.relations?.edges?.find(
    (edge) =>
      edge.relationType === "SEQUEL" &&
      edge.node?.type === "ANIME" &&
      edge.node.format === "SPECIAL" &&
      typeof edge.node.id === "number" &&
      edge.node.id > 0,
  )?.node;

  return advanceFribbPlaybackAcrossSpecialSequels({
    anilistId: input.anilistId,
    relativeEpisode: input.relativeEpisode,
    segmentStart: input.segmentStart,
    episodeCount: baseMedia?.episodes,
    sequelSpecialId: sequelNode?.id,
  });
};

export const resolveAnimePlaybackCoords = async (input: {
  tmdbShowId?: number | null;
  anilistId?: number | null;
  seasonNumber: number;
  episodeNumber: number;
}): Promise<AnimePlaybackCoords | null> => {
  const providedTmdbShowId =
    typeof input.tmdbShowId === "number" && input.tmdbShowId > 0
      ? input.tmdbShowId
      : null;
  const anilistId =
    typeof input.anilistId === "number" &&
    Number.isInteger(input.anilistId) &&
    input.anilistId > 0
      ? input.anilistId
      : null;

  const reversed =
    providedTmdbShowId || !anilistId
      ? null
      : await resolveAnilistToTmdbShow(anilistId);
  const resolvedTmdbShowId = providedTmdbShowId ?? reversed?.tmdbShowId ?? null;
  const seasonNumber =
    providedTmdbShowId || reversed?.seasonNumber == null
      ? input.seasonNumber
      : reversed.seasonNumber;

  if (typeof resolvedTmdbShowId === "number" && resolvedTmdbShowId > 0) {
    const fromTmdb = await resolveAnimePlaybackCoordsFromTmdb({
      tmdbShowId: resolvedTmdbShowId,
      seasonNumber,
      episodeNumber: input.episodeNumber,
    });
    if (
      fromTmdb &&
      (providedTmdbShowId || !anilistId || fromTmdb.anilistId === anilistId)
    ) {
      return fromTmdb;
    }
  }

  if (anilistId) {
    return enrichCoordsWithAnilistMeta({
      anilistId,
      relativeEpisodeNumber: input.episodeNumber,
      animeSeasonNumber: input.seasonNumber,
      animeInfo: {
        anilistId,
        startEpisode: 1,
        endEpisode: input.episodeNumber,
      },
      source: "anilist",
    });
  }

  return null;
};

const resolveAnimePlaybackCoordsFromTmdb = async (input: {
  tmdbShowId: number;
  seasonNumber: number;
  episodeNumber: number;
}): Promise<AnimePlaybackCoords | null> => {
  const { segments, source, useTmdbSeasonDisplay } =
    await resolveSeasonSegments({
      tmdbShowId: input.tmdbShowId,
      seasonNumber: input.seasonNumber,
    });

  const segment = segments.length
    ? resolveSegmentEpisodeCoords({
        segments,
        tmdbEpisodeNumber: input.episodeNumber,
      })
    : null;

  if (segment) {
    const playbackSource: AnimePlaybackCoords["source"] =
      source === "fribb" ? "fribb" : "anibridge";

    const mappings = await getAniBridgeMappings();
    const anibridgeCoords = resolveAniBridgePlaybackCoords(
      mappings,
      input.tmdbShowId,
      input.seasonNumber,
      input.episodeNumber,
    );

    const segmentCoords = resolveSegmentEpisodeCoords({
      segments,
      tmdbEpisodeNumber: input.episodeNumber,
      anibridgeRelativeEpisode:
        anibridgeCoords?.anilistId === segment.anilistId
          ? anibridgeCoords.relativeEpisode
          : null,
    });

    if (!segmentCoords) {
      return null;
    }

    return enrichCoordsWithAnilistMeta({
      anilistId: segmentCoords.anilistId,
      relativeEpisodeNumber: segmentCoords.relativeEpisodeNumber,
      animeSeasonNumber: useTmdbSeasonDisplay
        ? input.seasonNumber
        : segmentCoords.animeSeasonNumber,
      animeInfo: {
        anilistId: segmentCoords.anilistId,
        startEpisode: segmentCoords.segment.startEpisode,
        endEpisode: segmentCoords.segment.endEpisode,
      },
      source: playbackSource,
    });
  }

  const mappings = await getAniBridgeMappings();
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

  const adjusted = await applySpecialSequelAdvance(fribb);

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
