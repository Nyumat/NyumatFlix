"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { applySegmentAnimeEpisodeMapping } from "@/lib/anime/apply-segment-episode-mapping";
import { resolveEpisodeAnimeSelection } from "@/lib/anime/episode-playback-source";
import {
  resolveAnimeEpisodeMappingTmdbShowId,
  shouldAwaitPlaybackTmdbTvIdForMapping,
} from "@/lib/anime/resolve-coords-tmdb-show-id";
import { resolveEpisodeAnimeMapping } from "@/lib/anime/resolve-episode-mapping";
import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";
import { queryStaleTime } from "@/lib/cache-policy";
import type { Episode } from "@/lib/domain/typings";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { queryKeys } from "@/lib/query-keys";
import {
  useEpisodeStore,
  type AnimeEpisodeMappingContext,
} from "@/lib/stores/episode-store";

type AnimeSeasonMap = {
  segments?: MappingSegment[];
  isAdult?: boolean;
};

type UseAnimeEpisodeCoordsOptions = {
  tvRouteId: string;
  mappedTmdbTvId: number | null;
  enabled?: boolean;
};

const applyEmbeddedEpisodeSelection = (
  episode: Episode,
  seasonNumber: number,
  isAdult: boolean,
  context: AnimeEpisodeMappingContext,
): boolean => {
  const embedded = resolveEpisodeAnimeSelection(episode, {
    animeSeasonNumber: seasonNumber,
    isAdult,
  });

  if (!embedded) {
    return false;
  }

  useEpisodeStore.getState().applyAnimeEpisodeMapping(
    {
      animeInfo: embedded.animeInfo,
      relativeEpisodeNumber: embedded.mapping.relativeEpisodeNumber,
      confidence: embedded.mapping.confidence,
      isAdult: embedded.mapping.isAdult,
      genres: embedded.mapping.genres,
      animeSeasonNumber: embedded.mapping.animeSeasonNumber,
    },
    context,
  );

  return true;
};

/**
 * Single resolver for AniList episode coords: season segment map + coords API.
 */
export function useAnimeEpisodeCoords({
  tvRouteId,
  mappedTmdbTvId,
  enabled = true,
}: UseAnimeEpisodeCoordsOptions) {
  const isHydrated = useIsHydrated();
  const selectedEpisode = useEpisodeStore((state) => state.selectedEpisode);
  const tvShowId = useEpisodeStore((state) => state.tvShowId);
  const seasonNumber = useEpisodeStore((state) => state.seasonNumber);
  const defaultAnilistId = useEpisodeStore((state) => state.defaultAnilistId);
  const defaultIsAdultAnime = useEpisodeStore(
    (state) => state.defaultIsAdultAnime,
  );
  const playbackTmdbTvId = useEpisodeStore((state) => state.playbackTmdbTvId);
  const applyAnimeEpisodeMapping = useEpisodeStore(
    (state) => state.applyAnimeEpisodeMapping,
  );
  const setAnimeCoordsStatus = useEpisodeStore(
    (state) => state.setAnimeCoordsStatus,
  );

  const animeMapTmdbShowId =
    typeof mappedTmdbTvId === "number" && mappedTmdbTvId > 0
      ? mappedTmdbTvId
      : null;
  const canFetchSeasonMap =
    enabled &&
    Number.isInteger(defaultAnilistId) &&
    typeof animeMapTmdbShowId === "number" &&
    animeMapTmdbShowId > 0 &&
    seasonNumber != null &&
    seasonNumber > 0;

  const animeSeasonMapQuery = useQuery({
    queryKey: queryKeys.animeSeasonMap(
      animeMapTmdbShowId ?? 0,
      seasonNumber ?? 0,
      defaultAnilistId ?? 0,
    ),
    queryFn: async (): Promise<AnimeSeasonMap> => {
      const response = await fetch(
        `/api/map?tmdbShowId=${encodeURIComponent(String(animeMapTmdbShowId))}&tmdbSeason=${seasonNumber}&sourceAnilistId=${defaultAnilistId}`,
      );
      if (!response.ok) {
        throw new Error("anime season map failed");
      }
      return response.json() as Promise<AnimeSeasonMap>;
    },
    enabled: isHydrated && canFetchSeasonMap,
    staleTime: queryStaleTime(60 * 60 * 1000),
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!defaultAnilistId || !selectedEpisode || !tvShowId || !seasonNumber) {
      return;
    }

    if (tvShowId !== tvRouteId) {
      return;
    }

    const mappingContext: AnimeEpisodeMappingContext = {
      tvShowId: tvRouteId,
      seasonNumber,
      episodeNumber: selectedEpisode.episode_number,
    };

    const segments = animeSeasonMapQuery.data?.segments ?? [];
    if (segments.length > 0) {
      const applied = applySegmentAnimeEpisodeMapping(
        segments,
        selectedEpisode.episode_number,
        {
          ...mappingContext,
          isAdult:
            animeSeasonMapQuery.data?.isAdult === true || defaultIsAdultAnime,
        },
      );
      if (applied) {
        return;
      }
    }

    const current = useEpisodeStore.getState();
    if (
      current.anilistId &&
      current.animeCoordsStatus === "resolved" &&
      current.mappingConfidence === "high" &&
      current.seasonNumber === seasonNumber &&
      current.selectedEpisode?.episode_number === selectedEpisode.episode_number
    ) {
      return;
    }

    const tmdbShowId = resolveAnimeEpisodeMappingTmdbShowId(
      tvRouteId,
      defaultAnilistId,
      playbackTmdbTvId,
    );

    if (tmdbShowId === null) {
      if (
        applyEmbeddedEpisodeSelection(
          selectedEpisode,
          seasonNumber,
          defaultIsAdultAnime,
          mappingContext,
        )
      ) {
        return;
      }

      if (
        shouldAwaitPlaybackTmdbTvIdForMapping(
          tvRouteId,
          defaultAnilistId,
          playbackTmdbTvId,
        )
      ) {
        if (current.animeCoordsStatus !== "pending") {
          setAnimeCoordsStatus("pending");
        }
        return;
      }

      if (current.animeCoordsStatus !== "miss") {
        setAnimeCoordsStatus("miss");
      }
      return;
    }

    let cancelled = false;

    if (current.animeCoordsStatus !== "pending") {
      setAnimeCoordsStatus("pending");
    }

    void resolveEpisodeAnimeMapping({
      tmdbShowId,
      seasonNumber,
      episodeNumber: selectedEpisode.episode_number,
      isAdult: defaultIsAdultAnime,
    }).then((coords) => {
      if (cancelled) {
        return;
      }

      if (!coords) {
        if (
          applyEmbeddedEpisodeSelection(
            selectedEpisode,
            seasonNumber,
            defaultIsAdultAnime,
            mappingContext,
          )
        ) {
          return;
        }

        const latest = useEpisodeStore.getState();
        if (
          latest.tvShowId === mappingContext.tvShowId &&
          latest.seasonNumber === mappingContext.seasonNumber &&
          latest.selectedEpisode?.episode_number ===
            mappingContext.episodeNumber &&
          latest.animeCoordsStatus !== "miss"
        ) {
          setAnimeCoordsStatus("miss");
        }
        return;
      }

      applyAnimeEpisodeMapping(
        {
          animeInfo: coords.animeInfo,
          relativeEpisodeNumber: coords.relativeEpisodeNumber,
          confidence: coords.confidence,
          isAdult: coords.isAdult,
          genres: coords.genres,
          animeSeasonNumber: coords.animeSeasonNumber,
        },
        mappingContext,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    animeSeasonMapQuery.data?.isAdult,
    animeSeasonMapQuery.data?.segments,
    applyAnimeEpisodeMapping,
    defaultAnilistId,
    defaultIsAdultAnime,
    enabled,
    playbackTmdbTvId,
    seasonNumber,
    selectedEpisode,
    setAnimeCoordsStatus,
    tvRouteId,
    tvShowId,
  ]);
}
