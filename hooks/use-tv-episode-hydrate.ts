"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import type { Episode } from "@/lib/domain/typings";
import { queryKeys } from "@/lib/query-keys";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import {
  isSameTvWatchTarget,
  resolveTvWatchTarget,
} from "@/lib/tv-watch-target";

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
    );
  }, [
    initialEpisode,
    initialSeasonNumber,
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
    target.source !== "watchlist" &&
    isSameTvWatchTarget(
      target,
      { selectedEpisode, tvShowId, seasonNumber },
      mediaId,
    );

  const seasonQuery = useQuery({
    queryKey: queryKeys.tvSeason(
      mediaId,
      target?.source === "watchlist" ? target.seasonNumber : 0,
    ),
    queryFn: () =>
      fetchSeasonDetails(
        contentIdStr,
        (target as { seasonNumber: number }).seasonNumber,
      ),
    enabled:
      mediaType === "tv" &&
      target?.source === "watchlist" &&
      !shouldSkipHydrate,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (mediaType !== "tv" || !target || shouldSkipHydrate) {
      return;
    }

    if (target.source === "watchlist") {
      const seasonData = seasonQuery.data;
      if (!seasonData) {
        return;
      }

      const episode =
        seasonData.episodes?.find(
          (item) => item.episode_number === target.episodeNumber,
        ) ?? null;

      if (!episode) {
        return;
      }

      if (
        isSameTvWatchTarget(
          target,
          {
            selectedEpisode: useEpisodeStore.getState().selectedEpisode,
            tvShowId: useEpisodeStore.getState().tvShowId,
            seasonNumber: useEpisodeStore.getState().seasonNumber,
          },
          mediaId,
        )
      ) {
        return;
      }

      setSelectedEpisode(
        episode,
        contentIdStr,
        target.seasonNumber,
        undefined,
        true,
        seasonData.episodes,
      );
      return;
    }

    if (
      isSameTvWatchTarget(
        target,
        {
          selectedEpisode: useEpisodeStore.getState().selectedEpisode,
          tvShowId: useEpisodeStore.getState().tvShowId,
          seasonNumber: useEpisodeStore.getState().seasonNumber,
        },
        mediaId,
      )
    ) {
      return;
    }

    setSelectedEpisode(
      target.episode,
      contentIdStr,
      target.seasonNumber,
      undefined,
      true,
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
