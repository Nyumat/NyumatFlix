"use client";

import { useEffect } from "react";

import { resolveEpisodeAnimeMapping } from "@/lib/anime/resolve-episode-mapping";
import { useEpisodeStore } from "@/lib/stores/episode-store";

export function useAnimeEpisodeMapping() {
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

  useEffect(() => {
    if (!defaultAnilistId || !selectedEpisode || !tvShowId || !seasonNumber) {
      return;
    }

    const routeId = String(tvShowId);
    if (!Number.isInteger(Number(routeId))) {
      return;
    }

    const current = useEpisodeStore.getState();
    if (
      current.anilistId &&
      current.animeCoordsStatus === "resolved" &&
      current.mappingConfidence === "high"
    ) {
      return;
    }

    let cancelled = false;

    const tmdbShowId =
      typeof playbackTmdbTvId === "number" && playbackTmdbTvId > 0
        ? playbackTmdbTvId
        : Number(routeId);

    if (!Number.isInteger(tmdbShowId) || tmdbShowId <= 0) {
      if (current.animeCoordsStatus !== "pending") {
        setAnimeCoordsStatus("pending");
      }
      return;
    }

    if (
      defaultAnilistId > 0 &&
      tmdbShowId === defaultAnilistId &&
      playbackTmdbTvId == null
    ) {
      if (current.animeCoordsStatus !== "pending") {
        setAnimeCoordsStatus("pending");
      }
      return;
    }

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
        if (current.animeCoordsStatus !== "miss") {
          setAnimeCoordsStatus("miss");
        }
        return;
      }

      applyAnimeEpisodeMapping({
        animeInfo: coords.animeInfo,
        relativeEpisodeNumber: coords.relativeEpisodeNumber,
        confidence: coords.confidence,
        isAdult: coords.isAdult,
        genres: coords.genres,
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
    playbackTmdbTvId,
    seasonNumber,
    selectedEpisode,
    setAnimeCoordsStatus,
    tvShowId,
  ]);
}
