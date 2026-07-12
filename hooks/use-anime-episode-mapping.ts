"use client";

import { useEffect } from "react";

import { resolveEpisodeAnimeMapping } from "@/lib/anime/resolve-episode-mapping";
import {
  fromAnilistTvRouteId,
  isAnilistTvRouteId,
} from "@/lib/anilist-route-id";
import { useEpisodeStore } from "@/lib/stores/episode-store";

export function useAnimeEpisodeMapping() {
  const selectedEpisode = useEpisodeStore((state) => state.selectedEpisode);
  const tvShowId = useEpisodeStore((state) => state.tvShowId);
  const seasonNumber = useEpisodeStore((state) => state.seasonNumber);
  const defaultAnilistId = useEpisodeStore((state) => state.defaultAnilistId);
  const defaultIsAdultAnime = useEpisodeStore(
    (state) => state.defaultIsAdultAnime,
  );
  const applyAnimeEpisodeMapping = useEpisodeStore(
    (state) => state.applyAnimeEpisodeMapping,
  );

  useEffect(() => {
    if (
      !defaultAnilistId ||
      !selectedEpisode ||
      !tvShowId ||
      !seasonNumber ||
      !Number.isInteger(Number(tvShowId))
    ) {
      return;
    }

    let cancelled = false;

    if (isAnilistTvRouteId(tvShowId)) {
      const anilistId = fromAnilistTvRouteId(tvShowId);
      applyAnimeEpisodeMapping({
        animeInfo: {
          anilistId,
          startEpisode: selectedEpisode.episode_number,
          endEpisode: selectedEpisode.episode_number,
        },
        confidence: "high",
        isAdult: defaultIsAdultAnime,
        animeSeasonNumber: seasonNumber,
      });
      return;
    }

    void resolveEpisodeAnimeMapping({
      tmdbShowId: Number(tvShowId),
      seasonNumber,
      episodeNumber: selectedEpisode.episode_number,
      sourceAnilistId: defaultAnilistId,
    }).then((coords) => {
      if (cancelled || !coords) {
        return;
      }

      applyAnimeEpisodeMapping({
        animeInfo: coords.animeInfo,
        confidence: coords.confidence,
        isAdult: coords.isAdult,
        animeSeasonNumber: coords.animeSeasonNumber,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    applyAnimeEpisodeMapping,
    defaultAnilistId,
    defaultIsAdultAnime,
    seasonNumber,
    selectedEpisode,
    tvShowId,
  ]);
}
