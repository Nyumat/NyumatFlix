"use client";

import { usePlaybackProgressRevision } from "@/hooks/use-playback-progress-revision";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { useSignedInWatchlistEnabled } from "@/hooks/use-signed-in-watchlist-enabled";
import { queryKeys } from "@/lib/query-keys";
import { watchlistQueryOptions } from "@/lib/watchlist/watchlist-queries";
import { clientRecentlyWatchedEnrichmentFetchers } from "@/lib/playback/enrich-recently-watched-client";
import { enrichRecentlyWatchedStubsChunked } from "@/lib/playback/enrich-recently-watched";
import {
  collectLocalWatchHistoryStubs,
  matchesRecentlyWatchedScope,
  mediaTypesForScope,
  WATCH_HISTORY_LIMIT,
  type RecentlyWatchedScope,
} from "@/lib/playback/recently-watched";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function useWatchHistory(scope: RecentlyWatchedScope = "all") {
  const hydrated = useIsHydrated();
  const progressRevision = usePlaybackProgressRevision();
  const mediaTypes = mediaTypesForScope(scope);
  const watchlistEnabled = useSignedInWatchlistEnabled();

  const watchlistQuery = useQuery({
    ...watchlistQueryOptions(),
    enabled: watchlistEnabled,
  });

  const stubs = useMemo(() => {
    if (!hydrated) {
      return null;
    }

    return collectLocalWatchHistoryStubs(watchlistQuery.data ?? [], {
      limit: WATCH_HISTORY_LIMIT,
      mediaTypes,
    });
  }, [hydrated, watchlistQuery.data, mediaTypes, progressRevision]);

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
    queryKey: [...queryKeys.watchlist(), "watch-history", scope, stubsKey],
    queryFn: () =>
      enrichRecentlyWatchedStubsChunked(
        stubs ?? [],
        clientRecentlyWatchedEnrichmentFetchers,
        { includeTvCompleteFields: false },
      ),
    enabled: stubs !== null && stubs.length > 0,
  });

  const items = useMemo(
    () =>
      (itemsQuery.data ?? []).filter((item) =>
        matchesRecentlyWatchedScope(item, scope),
      ),
    [itemsQuery.data, scope],
  );

  const isLoading =
    !hydrated ||
    (watchlistEnabled && watchlistQuery.isLoading) ||
    (Boolean(stubs?.length) && itemsQuery.isLoading);

  return {
    items,
    isLoading,
  };
}
