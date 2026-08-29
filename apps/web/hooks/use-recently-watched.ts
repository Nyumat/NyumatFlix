"use client";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  tvCompleteFieldsFromDetail,
  watchlistStatusAfterComplete,
} from "@/lib/playback/continue-watching-complete";
import {
  continueWatchingTitleKey,
  dismissContinueWatchingTitle,
  readContinueWatchingDismissals,
} from "@/lib/playback/continue-watching-dismiss";
import { loginHref } from "@/lib/auth/callback-url";
import { queryStaleTime } from "@/lib/cache-policy";
import { queryKeys } from "@/lib/query-keys";
import {
  RECENTLY_WATCHED_LIMIT,
  collectLocalRecentlyWatchedStubs,
  matchesRecentlyWatchedScope,
  mediaTypesForScope,
  toRecentlyWatchedItem,
  type RecentlyWatchedItem,
  type RecentlyWatchedScope,
  type RecentlyWatchedStub,
} from "@/lib/playback/recently-watched";
import { applyContinueWatchingComplete } from "@/lib/watchlist/apply-continue-watching-complete";
import { isAnime } from "@/utils/anilist-helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  status?: string | null;
  last_episode_to_air?: unknown;
  next_episode_to_air?: unknown;
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

function detectAnime(detail: MediaDetailResponse): boolean {
  return isAnime(detail);
}

async function fetchMediaDetail(
  stub: RecentlyWatchedStub,
): Promise<RecentlyWatchedItem | null> {
  const path =
    stub.mediaType === "movie"
      ? `/api/movies/${stub.contentId}`
      : `/api/tv/${stub.contentId}`;

  const response = await fetch(path);
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
  const title =
    stub.mediaType === "movie"
      ? (detail.title ?? stub.title)
      : (detail.name ?? stub.title);

  if (!title) {
    return null;
  }

  const date =
    stub.mediaType === "movie" ? detail.release_date : detail.first_air_date;

  const tvFields =
    stub.mediaType === "tv" ? tvCompleteFieldsFromDetail(detail) : {};

  return toRecentlyWatchedItem(stub, {
    title,
    backdropPath: detail.backdrop_path ?? stub.backdropPath,
    posterPath: detail.poster_path ?? stub.posterPath,
    voteAverage: detail.vote_average,
    year: date?.substring(0, 4),
    isAnime: detectAnime(detail),
    ...tvFields,
  });
}

async function enrichStubs(
  stubs: RecentlyWatchedStub[],
): Promise<RecentlyWatchedItem[]> {
  const results = await Promise.all(
    stubs.map((stub) => fetchMediaDetail(stub)),
  );
  return results.filter((item): item is RecentlyWatchedItem => item !== null);
}

export function useRecentlyWatched(scope: RecentlyWatchedScope = "all") {
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const isSignedIn = Boolean(session?.user?.id);
  const [hydrated, setHydrated] = useState(false);
  const [dismissTick, setDismissTick] = useState(0);
  const [pendingCompleteKey, setPendingCompleteKey] = useState<string | null>(
    null,
  );
  const mediaTypes = mediaTypesForScope(scope);
  const collectLimit =
    scope === "tv" || scope === "anime"
      ? RECENTLY_WATCHED_LIMIT * 2
      : RECENTLY_WATCHED_LIMIT;

  useEffect(() => {
    setHydrated(true);
  }, []);

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist(),
    queryFn: fetchWatchlistItems,
    enabled: isSignedIn,
    staleTime: queryStaleTime(60_000),
  });

  const stubs = useMemo(() => {
    if (!hydrated) {
      return null;
    }
    return collectLocalRecentlyWatchedStubs(watchlistQuery.data ?? [], {
      limit: collectLimit,
      mediaTypes,
      dismissals: readContinueWatchingDismissals(),
    });
  }, [hydrated, watchlistQuery.data, collectLimit, mediaTypes, dismissTick]);

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
    queryFn: () => enrichStubs(stubs ?? []),
    enabled: stubs !== null && stubs.length > 0,
    staleTime: queryStaleTime(5 * 60_000),
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

  const isLoading =
    !hydrated ||
    sessionStatus === "loading" ||
    (isSignedIn && watchlistQuery.isLoading) ||
    (Boolean(stubs?.length) && itemsQuery.isLoading);

  const markComplete = useCallback(
    async (item: RecentlyWatchedItem) => {
      setPendingCompleteKey(
        continueWatchingTitleKey(item.mediaType, item.contentId),
      );
      dismissContinueWatchingTitle(
        item.mediaType,
        item.contentId,
        Math.max(Date.now(), item.updatedAt),
      );
      setDismissTick((tick) => tick + 1);

      const status = watchlistStatusAfterComplete({
        mediaType: item.mediaType,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        lastAiredSeason: item.lastAiredSeason,
        lastAiredEpisode: item.lastAiredEpisode,
        showStatus: item.showStatus,
        hasNextEpisode: item.hasNextEpisode,
      });

      try {
        if (isSignedIn) {
          await applyContinueWatchingComplete({
            contentId: item.contentId,
            mediaType: item.mediaType,
            status,
            seasonNumber: item.seasonNumber,
            episodeNumber: item.episodeNumber,
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.watchlist(),
          });
        } else {
          toast("Marked as complete on this device", {
            description: "Make an account to sync across devices.",
            action: {
              label: "Sign in",
              onClick: () => {
                window.location.assign(
                  loginHref(
                    `${window.location.pathname}${window.location.search}`,
                  ),
                );
              },
            },
          });
        }
      } catch {
        toast.error("Couldn't update watchlist");
      } finally {
        setPendingCompleteKey(null);
      }
    },
    [isSignedIn, queryClient],
  );

  return {
    items,
    isLoading,
    isSignedIn,
    markComplete,
    pendingCompleteKey,
  };
}
