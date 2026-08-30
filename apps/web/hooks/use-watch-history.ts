"use client";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import { queryKeys } from "@/lib/query-keys";
import {
  collectLocalWatchHistoryStubs,
  matchesRecentlyWatchedScope,
  mediaTypesForScope,
  toRecentlyWatchedItem,
  WATCH_HISTORY_LIMIT,
  type RecentlyWatchedItem,
  type RecentlyWatchedScope,
  type RecentlyWatchedStub,
} from "@/lib/playback/recently-watched";
import { usePlaybackProgressRevision } from "@/hooks/use-playback-progress-revision";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { fetchTvShowDetailClient } from "@/lib/tv-show-detail-client";
import { isAnime } from "@/utils/anilist-helpers";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

type MediaDetailResponse = {
  title?: string;
  name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name?: string }>;
};

async function fetchWatchlistItems(): Promise<WatchlistItem[]> {
  const response = await fetch("/api/watchlist");
  if (response.status === 401) {
    return [];
  }
  if (!response.ok) {
    throw new Error("Failed to fetch watchlist");
  }
  const data = (await response.json()) as { items?: WatchlistItem[] };
  return data.items ?? [];
}

async function fetchMediaDetail(
  stub: RecentlyWatchedStub,
): Promise<RecentlyWatchedItem | null> {
  if (stub.mediaType === "movie") {
    const response = await fetch(`/api/movies/${stub.contentId}`);
    if (!response.ok) {
      if (stub.title) {
        return toRecentlyWatchedItem(stub, {
          title: stub.title,
          backdropPath: stub.backdropPath,
          posterPath: stub.posterPath,
          isAnime: false,
        });
      }
      return null;
    }

    const detail = (await response.json()) as MediaDetailResponse;
    const title = detail.title ?? stub.title;
    if (!title) {
      return null;
    }

    return toRecentlyWatchedItem(stub, {
      title,
      backdropPath: detail.backdrop_path ?? stub.backdropPath,
      posterPath: detail.poster_path ?? stub.posterPath,
      voteAverage: detail.vote_average,
      year: detail.release_date?.substring(0, 4),
      isAnime: false,
    });
  }

  const fetched = await fetchTvShowDetailClient(stub.contentId, {
    expectedTitle: stub.title,
  });
  if (!fetched) {
    if (stub.title) {
      return toRecentlyWatchedItem(stub, {
        title: stub.title,
        backdropPath: stub.backdropPath,
        posterPath: stub.posterPath,
        isAnime: false,
      });
    }
    return null;
  }

  const detail = fetched.detail;
  const title = detail.name ?? stub.title;
  if (!title) {
    return null;
  }

  return toRecentlyWatchedItem(stub, {
    title,
    backdropPath: detail.backdrop_path ?? stub.backdropPath,
    posterPath: detail.poster_path ?? stub.posterPath,
    voteAverage: detail.vote_average,
    year: detail.first_air_date?.substring(0, 4),
    isAnime: fetched.catalog === "anime" || isAnime(detail),
  });
}

async function enrichStubs(
  stubs: RecentlyWatchedStub[],
): Promise<RecentlyWatchedItem[]> {
  const results: RecentlyWatchedItem[] = [];
  const chunkSize = 8;

  for (let index = 0; index < stubs.length; index += chunkSize) {
    const chunk = stubs.slice(index, index + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((stub) => fetchMediaDetail(stub)),
    );

    for (const item of chunkResults) {
      if (item) {
        results.push(item);
      }
    }
  }

  return results;
}

export function useWatchHistory(scope: RecentlyWatchedScope = "all") {
  const hydrated = useIsHydrated();
  const progressRevision = usePlaybackProgressRevision();
  const mediaTypes = mediaTypesForScope(scope);
  const collectLimit =
    scope === "tv" || scope === "anime"
      ? WATCH_HISTORY_LIMIT * 2
      : WATCH_HISTORY_LIMIT;

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist(),
    queryFn: fetchWatchlistItems,
    staleTime: 60_000,
  });

  const stubs = useMemo(() => {
    if (!hydrated) {
      return null;
    }

    return collectLocalWatchHistoryStubs(watchlistQuery.data ?? [], {
      limit: collectLimit,
      mediaTypes,
    });
  }, [
    hydrated,
    watchlistQuery.data,
    collectLimit,
    mediaTypes,
    progressRevision,
  ]);

  const stubsKey = useMemo(
    () =>
      stubs
        ?.map(
          (stub) =>
            `${stub.mediaType}:${stub.contentId}:${stub.seasonNumber ?? ""}:${stub.episodeNumber ?? ""}:${stub.updatedAt}`,
        )
        .join("|") ?? "",
    [stubs],
  );

  const itemsQuery = useQuery({
    queryKey: queryKeys.watchHistory(scope, stubsKey),
    queryFn: () => enrichStubs(stubs ?? []),
    enabled: stubs !== null && stubs.length > 0,
    staleTime: 5 * 60_000,
  });

  const items = useMemo(() => {
    if (!stubs?.length) {
      return [];
    }

    const stubKeys = new Set(
      stubs.map((stub) => `${stub.mediaType}:${stub.contentId}`),
    );

    return (itemsQuery.data ?? [])
      .filter((item) => stubKeys.has(`${item.mediaType}:${item.contentId}`))
      .filter((item) => matchesRecentlyWatchedScope(item, scope))
      .slice(0, WATCH_HISTORY_LIMIT);
  }, [itemsQuery.data, scope, stubs]);

  const isLoading =
    !hydrated ||
    watchlistQuery.isLoading ||
    (Boolean(stubs?.length) && itemsQuery.isLoading);

  return {
    items,
    isLoading,
  };
}
