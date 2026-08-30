"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import type { Episode } from "@/lib/domain/typings";
import { queryStaleTime } from "@/lib/cache-policy";
import { queryKeys } from "@/lib/query-keys";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useLocalTvWatchCoords } from "@/hooks/use-local-tv-watch-coords";
import {
  isSameTvWatchTarget,
  isTvCoordsWatchTarget,
  resolveTvWatchTarget,
} from "@/lib/tv-watch-target";
import { resolveEpisodeAnimeSelection } from "@/lib/anime/episode-playback-source";

type UseTvEpisodeHydrateOptions = {
  mediaId: number;
  mediaType?: "tv" | "movie";
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
};

export function useTvEpisodeHydrate({
  mediaId,
  mediaType,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
}: UseTvEpisodeHydrateOptions) {
  const { selectedEpisode, tvShowId, seasonNumber, setSelectedEpisode } =
    useEpisodeStore();
  const localCoords = useLocalTvWatchCoords(mediaId);
  const hydrateGenerationRef = useRef(0);

  const target = useMemo(() => {
    if (mediaType !== "tv") {
      return null;
    }

    return resolveTvWatchTarget(
      mediaId,
      { selectedEpisode, tvShowId, seasonNumber },
      watchlistItem,
      initialEpisode,
      initialSeasonNumber,
      localCoords,
    );
  }, [
    initialEpisode,
    initialSeasonNumber,
    localCoords,
    mediaId,
    mediaType,
    seasonNumber,
    selectedEpisode,
    tvShowId,
    watchlistItem,
  ]);

  const contentIdStr = mediaId.toString();
  const shouldSkipHydrate =
    target != null &&
    !isTvCoordsWatchTarget(target) &&
    isSameTvWatchTarget(
      target,
      { selectedEpisode, tvShowId, seasonNumber },
      mediaId,
    );
  const coordsTarget = target && isTvCoordsWatchTarget(target) ? target : null;

  const seasonQuery = useQuery({
    queryKey: queryKeys.tvSeasonRoute(
      contentIdStr,
      coordsTarget?.seasonNumber ?? 0,
    ),
    queryFn: () =>
      fetchSeasonDetails(contentIdStr, coordsTarget?.seasonNumber ?? 0),
    enabled: mediaType === "tv" && coordsTarget != null && !shouldSkipHydrate,
    staleTime: queryStaleTime(10 * 60 * 1000),
  });

  useEffect(() => {
    const generation = ++hydrateGenerationRef.current;

    if (mediaType !== "tv" || !target || shouldSkipHydrate) {
      return;
    }

    const isStale = () => generation !== hydrateGenerationRef.current;

    const matchesTarget = () => {
      const state = useEpisodeStore.getState();
      return isSameTvWatchTarget(
        target,
        {
          selectedEpisode: state.selectedEpisode,
          tvShowId: state.tvShowId,
          seasonNumber: state.seasonNumber,
        },
        mediaId,
      );
    };

    if (isTvCoordsWatchTarget(target)) {
      const seasonData = seasonQuery.data;
      if (!seasonData || isStale()) {
        return;
      }

      const episode =
        seasonData.episodes?.find(
          (item) => item.episode_number === target.episodeNumber,
        ) ?? null;

      if (!episode || isStale() || matchesTarget()) {
        return;
      }

      const embeddedSelection = resolveEpisodeAnimeSelection(episode, {
        animeSeasonNumber: target.seasonNumber,
      });

      setSelectedEpisode(
        episode,
        contentIdStr,
        target.seasonNumber,
        embeddedSelection?.animeInfo,
        true,
        seasonData.episodes,
        embeddedSelection?.mapping,
      );
      return;
    }

    if (isStale() || matchesTarget()) {
      return;
    }

    const embeddedSelection = resolveEpisodeAnimeSelection(target.episode, {
      animeSeasonNumber: target.seasonNumber,
    });

    setSelectedEpisode(
      target.episode,
      contentIdStr,
      target.seasonNumber,
      embeddedSelection?.animeInfo,
      true,
      undefined,
      embeddedSelection?.mapping,
    );
  }, [
    contentIdStr,
    mediaId,
    mediaType,
    seasonQuery.data,
    setSelectedEpisode,
    shouldSkipHydrate,
    target,
  ]);
}
