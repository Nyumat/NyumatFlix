"use client";

import { fetchBecauseYouWatchedRow } from "@/lib/personalization/because-you-watched";
import { queryKeys } from "@/lib/query-keys";
import {
  collectLocalRecentlyWatchedStubs,
  RECENTLY_WATCHED_LIMIT,
} from "@/lib/playback/recently-watched";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { useQuery } from "@tanstack/react-query";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { useMemo } from "react";

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

export function useBecauseYouWatched() {
  const hydrated = useIsHydrated();

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist(),
    queryFn: fetchWatchlistItems,
    staleTime: 60_000,
  });

  const stubs = useMemo(() => {
    if (!hydrated) {
      return null;
    }

    return collectLocalRecentlyWatchedStubs(watchlistQuery.data ?? [], {
      limit: RECENTLY_WATCHED_LIMIT,
    });
  }, [hydrated, watchlistQuery.data]);

  const stubsKey = useMemo(
    () =>
      stubs
        ?.map(
          (stub) =>
            `${stub.mediaType}:${stub.contentId}:${stub.updatedAt}:${stub.seasonNumber ?? ""}:${stub.episodeNumber ?? ""}`,
        )
        .join("|") ?? "",
    [stubs],
  );

  const rowQuery = useQuery({
    queryKey: queryKeys.becauseYouWatched(stubsKey),
    queryFn: async () => {
      if (!stubs?.length) {
        return null;
      }

      const excludeIds = new Set(stubs.map((stub) => stub.contentId));
      return fetchBecauseYouWatchedRow(stubs, excludeIds);
    },
    enabled: hydrated && Boolean(stubs?.length),
    staleTime: 30 * 60_000,
  });

  const isLoading =
    !hydrated ||
    watchlistQuery.isLoading ||
    (Boolean(stubs?.length) && rowQuery.isLoading);

  return {
    row: rowQuery.data ?? null,
    isLoading,
  };
}
