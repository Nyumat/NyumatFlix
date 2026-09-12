"use client";

import { useContinueWatchingActions } from "@/hooks/use-continue-watching-actions";
import { usePlaybackProgressRevision } from "@/hooks/use-playback-progress-revision";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { useSignedInWatchlistEnabled } from "@/hooks/use-signed-in-watchlist-enabled";
import { fetchBulkMediaShellsClient } from "@/lib/media/bulk-media-shell-client";
import { queryStaleTime } from "@/lib/cache-policy";
import { clientRecentlyWatchedEnrichmentFetchers } from "@/lib/playback/enrich-recently-watched-client";
import {
  enrichRecentlyWatchedStubs,
  type RecentlyWatchedEnrichmentFetchers,
} from "@/lib/playback/enrich-recently-watched";
import {
  collectLocalRecentlyWatchedStubs,
  matchesRecentlyWatchedScope,
  mediaTypesForScope,
  RECENTLY_WATCHED_LIMIT,
  type RecentlyWatchedScope,
} from "@/lib/playback/recently-watched";
import {
  continueWatchingTitleKey,
  readContinueWatchingDismissals,
} from "@/lib/playback/continue-watching-dismiss";
import { queryKeys } from "@/lib/query-keys";
import { watchlistQueryOptions } from "@/lib/watchlist/watchlist-queries";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useMemo } from "react";

export function useRecentlyWatched(
  scope: RecentlyWatchedScope = "all",
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const { status: sessionStatus } = useSession();
  const isSignedIn = useSignedInWatchlistEnabled(enabled);
  const hydrated = useIsHydrated();
  const progressRevision = usePlaybackProgressRevision();
  const { markComplete, pendingCompleteKey, dismissRevision } =
    useContinueWatchingActions();
  const mediaTypes = mediaTypesForScope(scope);
  const collectLimit =
    scope === "tv" || scope === "anime"
      ? RECENTLY_WATCHED_LIMIT * 2
      : RECENTLY_WATCHED_LIMIT;

  const watchlistQuery = useQuery({
    ...watchlistQueryOptions(),
    enabled: isSignedIn,
  });

  const stubs = useMemo(() => {
    if (!enabled || !hydrated) {
      return null;
    }
    return collectLocalRecentlyWatchedStubs(watchlistQuery.data ?? [], {
      limit: collectLimit,
      mediaTypes,
      dismissals: readContinueWatchingDismissals(),
    });
  }, [
    enabled,
    hydrated,
    watchlistQuery.data,
    collectLimit,
    mediaTypes,
    dismissRevision,
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
    queryKey: [...queryKeys.watchlist(), "recently-watched", scope, stubsKey],
    queryFn: async () => {
      const currentStubs = stubs ?? [];
      const movieStubs = currentStubs.filter(
        (stub) => stub.mediaType === "movie",
      );
      const movieShells = await fetchBulkMediaShellsClient(
        movieStubs.map((stub) => ({
          mediaType: "movie" as const,
          contentId: stub.contentId,
        })),
      );
      const fetchers: RecentlyWatchedEnrichmentFetchers = {
        ...clientRecentlyWatchedEnrichmentFetchers,
        fetchMovie: async (contentId) => {
          const shell = movieShells.get(`movie:${contentId}`);
          if (shell) {
            return {
              title: shell.title,
              backdrop_path: shell.backdrop_path,
              poster_path: shell.poster_path,
              vote_average: shell.vote_average,
              release_date: shell.release_date,
            };
          }
          return clientRecentlyWatchedEnrichmentFetchers.fetchMovie(contentId);
        },
      };
      return enrichRecentlyWatchedStubs(currentStubs, fetchers);
    },
    enabled: enabled && stubs !== null && stubs.length > 0,
    staleTime: queryStaleTime(5 * 60_000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const items = useMemo(() => {
    if (!stubs?.length) {
      return [];
    }
    const stubKeys = new Set(
      stubs.map((stub) => `${stub.mediaType}:${stub.contentId}`),
    );
    return (itemsQuery.data ?? [])
      .filter((item) =>
        stubKeys.has(continueWatchingTitleKey(item.mediaType, item.contentId)),
      )
      .filter((item) => matchesRecentlyWatchedScope(item, scope))
      .slice(0, RECENTLY_WATCHED_LIMIT);
  }, [itemsQuery.data, scope, stubs]);

  const isLoading = !enabled
    ? false
    : !hydrated ||
      sessionStatus === "loading" ||
      (isSignedIn && watchlistQuery.isLoading) ||
      (Boolean(stubs?.length) && itemsQuery.isLoading);

  return {
    items,
    isLoading,
    isSignedIn,
    markComplete,
    pendingCompleteKey,
  };
}
