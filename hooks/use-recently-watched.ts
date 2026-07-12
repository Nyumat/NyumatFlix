"use client";

import type { WatchlistItem } from "@/lib/domain/watchlist";
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
import { isAnime } from "@/utils/anilist-helpers";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

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

function detectAnime(detail: MediaDetailResponse): boolean {
  if (Array.isArray(detail.genre_ids) && detail.genre_ids.length > 0) {
    return isAnime(detail.genre_ids);
  }
  if (Array.isArray(detail.genres) && detail.genres.length > 0) {
    return isAnime(detail.genres);
  }
  return false;
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

  return toRecentlyWatchedItem(stub, {
    title,
    backdropPath: detail.backdrop_path ?? stub.backdropPath,
    posterPath: detail.poster_path ?? stub.posterPath,
    voteAverage: detail.vote_average,
    year: date?.substring(0, 4),
    isAnime: detectAnime(detail),
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
  const { data: session, status: sessionStatus } = useSession();
  const isSignedIn = Boolean(session?.user?.id);
  const [hydrated, setHydrated] = useState(false);
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
    staleTime: 60_000,
  });

  const stubs = useMemo(() => {
    if (!hydrated) {
      return null;
    }
    return collectLocalRecentlyWatchedStubs(watchlistQuery.data ?? [], {
      limit: collectLimit,
      mediaTypes,
    });
  }, [hydrated, watchlistQuery.data, collectLimit, mediaTypes]);

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
    staleTime: 5 * 60_000,
  });

  const items = useMemo(() => {
    if (!stubs?.length) {
      return [];
    }
    return (itemsQuery.data ?? [])
      .filter((item) => matchesRecentlyWatchedScope(item, scope))
      .slice(0, RECENTLY_WATCHED_LIMIT);
  }, [itemsQuery.data, scope, stubs]);

  const isLoading =
    !hydrated ||
    sessionStatus === "loading" ||
    (isSignedIn && watchlistQuery.isLoading) ||
    (Boolean(stubs?.length) && itemsQuery.isLoading);

  return {
    items,
    isLoading,
    isSignedIn,
  };
}
