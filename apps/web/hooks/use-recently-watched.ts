"use client";

import { useContinueWatchingActions } from "@/hooks/use-continue-watching-actions";
import { usePlaybackProgressRevision } from "@/hooks/use-playback-progress-revision";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { useSignedInWatchlistEnabled } from "@/hooks/use-signed-in-watchlist-enabled";
import { fetchBulkMediaShellsClient } from "@/lib/media/bulk-media-shell-client";
import { queryStaleTime } from "@/lib/cache-policy";
import { clientRecentlyWatchedEnrichmentFetchers } from "@/lib/playback/enrich-recently-watched-client";
import {
  applyRecentlyWatchedEnrichment,
  fetchRecentlyWatchedEnrichment,
  type RecentlyWatchedEnrichmentFetchers,
} from "@/lib/playback/enrich-recently-watched";
import {
  collectLocalRecentlyWatchedStubs,
  matchesRecentlyWatchedScope,
  mediaTypesForScope,
  RECENTLY_WATCHED_LIMIT,
  type RecentlyWatchedItem,
  type RecentlyWatchedScope,
} from "@/lib/playback/recently-watched";
import { readContinueWatchingDismissals } from "@/lib/playback/continue-watching-dismiss";
import { queryKeys } from "@/lib/query-keys";
import { watchlistQueryOptions } from "@/lib/watchlist/watchlist-queries";
import { useQueries, useQuery } from "@tanstack/react-query";
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

  const enrichmentFetchers = useMemo<RecentlyWatchedEnrichmentFetchers>(
    () => ({
      ...clientRecentlyWatchedEnrichmentFetchers,
      fetchMovie: async (contentId) => {
        const shells = await fetchBulkMediaShellsClient([
          { mediaType: "movie", contentId },
        ]);
        const shell = shells.get(`movie:${contentId}`);
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
      fetchTv: async (stub) => {
        const [fetched, shells] = await Promise.all([
          clientRecentlyWatchedEnrichmentFetchers.fetchTv(stub),
          fetchBulkMediaShellsClient([
            { mediaType: "tv", contentId: stub.contentId },
          ]),
        ]);
        if (!fetched) {
          return null;
        }
        const backdropPath = shells.get(`tv:${stub.contentId}`)?.backdrop_path;
        if (!backdropPath) {
          return fetched;
        }
        return {
          ...fetched,
          detail: { ...fetched.detail, backdrop_path: backdropPath },
        };
      },
    }),
    [],
  );

  // Enrichment is cached per title, so progress/updatedAt/season changes only
  // recompute `stubs` (cheap) and never refetch TMDB metadata.
  const enrichmentQueries = useQueries({
    queries: (stubs ?? []).map((stub) => ({
      queryKey: queryKeys.recentlyWatchedEnrichment(
        stub.mediaType,
        stub.contentId,
      ),
      queryFn: () => fetchRecentlyWatchedEnrichment(stub, enrichmentFetchers),
      enabled,
      staleTime: queryStaleTime(30 * 60_000),
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    })),
  });

  const items = stubs?.length
    ? stubs
        .flatMap((stub, index): RecentlyWatchedItem[] => {
          const enrichment = enrichmentQueries[index]?.data;
          if (!enrichment) {
            return [];
          }
          const item = applyRecentlyWatchedEnrichment(stub, enrichment);
          return item && matchesRecentlyWatchedScope(item, scope) ? [item] : [];
        })
        .slice(0, RECENTLY_WATCHED_LIMIT)
    : [];

  const isEnrichmentLoading =
    Boolean(stubs?.length) &&
    enrichmentQueries.some((query) => query.isLoading);

  const isLoading = !enabled
    ? false
    : !hydrated ||
      sessionStatus === "loading" ||
      (isSignedIn && watchlistQuery.isLoading) ||
      isEnrichmentLoading;

  return {
    items,
    isLoading,
    isSignedIn,
    markComplete,
    pendingCompleteKey,
  };
}
