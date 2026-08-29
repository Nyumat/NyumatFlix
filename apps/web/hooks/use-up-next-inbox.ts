"use client";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import type { EpisodeInfo } from "@/lib/domain/episodes";
import {
  buildUpNextHref,
  collectUpNextCandidates,
  parseEpisodeDataResponse,
  type UpNextCandidate,
} from "@/lib/personalization/up-next";
import { queryKeys } from "@/lib/query-keys";
import {
  toRecentlyWatchedItem,
  type RecentlyWatchedItem,
} from "@/lib/playback/recently-watched";
import { isAnime } from "@/utils/anilist-helpers";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useMemo } from "react";

export type UpNextInboxItem = RecentlyWatchedItem & {
  episodeInfo: EpisodeInfo;
  upNextHref: string;
};

type MediaDetailResponse = {
  id?: number;
  name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
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

async function fetchUpNextEpisodeData(): Promise<Record<number, EpisodeInfo>> {
  const response = await fetch("/api/watchlist/check-episodes?scope=watching");
  if (response.status === 401) {
    return {};
  }
  if (!response.ok) {
    throw new Error("Failed to fetch up next episodes");
  }

  const data = (await response.json()) as {
    episodeData?: Record<string, unknown>;
  };

  return parseEpisodeDataResponse(data.episodeData ?? {});
}

async function enrichUpNextCandidate(
  candidate: UpNextCandidate,
): Promise<UpNextInboxItem | null> {
  const response = await fetch(`/api/tv/${candidate.contentId}`);
  if (!response.ok) {
    return null;
  }

  const detail = (await response.json()) as MediaDetailResponse;
  if (detail.id !== candidate.contentId) {
    return null;
  }

  const title = detail.name;
  if (!title) {
    return null;
  }

  const stub = {
    mediaType: "tv" as const,
    contentId: candidate.contentId,
    seasonNumber:
      candidate.episodeInfo.nextUnwatchedEpisode?.seasonNumber ??
      candidate.watchlistItem.lastWatchedSeason ??
      undefined,
    episodeNumber:
      candidate.episodeInfo.nextUnwatchedEpisode?.episodeNumber ??
      candidate.watchlistItem.lastWatchedEpisode ??
      undefined,
    progressRatio: null,
    updatedAt: candidate.watchlistItem.lastWatchedAt
      ? new Date(candidate.watchlistItem.lastWatchedAt).getTime()
      : new Date(candidate.watchlistItem.updatedAt).getTime(),
  };

  const item = toRecentlyWatchedItem(stub, {
    title,
    backdropPath: detail.backdrop_path,
    posterPath: detail.poster_path,
    voteAverage: detail.vote_average,
    year: detail.first_air_date?.substring(0, 4),
    isAnime: isAnime(detail),
  });

  const upNextHref = buildUpNextHref(
    candidate.contentId,
    candidate.episodeInfo.nextUnwatchedEpisode,
    candidate.watchlistItem.lastWatchedSeason,
    candidate.watchlistItem.lastWatchedEpisode,
  );

  return {
    ...item,
    href: upNextHref,
    episodeInfo: candidate.episodeInfo,
    upNextHref,
  };
}

export function useUpNextInbox() {
  const { data: session, status: sessionStatus } = useSession();
  const isSignedIn = Boolean(session?.user?.id);

  const watchlistQuery = useQuery({
    queryKey: queryKeys.watchlist(),
    queryFn: fetchWatchlistItems,
    enabled: isSignedIn,
    staleTime: 60_000,
  });

  const episodeQuery = useQuery({
    queryKey: queryKeys.upNextInbox(),
    queryFn: fetchUpNextEpisodeData,
    enabled: isSignedIn,
    staleTime: 60 * 60_000,
  });

  const candidates = useMemo(
    () =>
      collectUpNextCandidates(
        watchlistQuery.data ?? [],
        episodeQuery.data ?? {},
      ),
    [watchlistQuery.data, episodeQuery.data],
  );

  const candidatesKey = useMemo(
    () =>
      candidates
        .map(
          (candidate) =>
            `${candidate.contentId}:${candidate.episodeInfo.unwatchedEpisodeCount}:${candidate.episodeInfo.nextUnwatchedEpisode?.seasonNumber ?? ""}:${candidate.episodeInfo.nextUnwatchedEpisode?.episodeNumber ?? ""}`,
        )
        .join("|"),
    [candidates],
  );

  const itemsQuery = useQuery({
    queryKey: [...queryKeys.upNextInbox(), "items", candidatesKey],
    queryFn: async () => {
      const results = await Promise.all(
        candidates.map((candidate) => enrichUpNextCandidate(candidate)),
      );
      return results.filter((item): item is UpNextInboxItem => item !== null);
    },
    enabled: isSignedIn && candidates.length > 0,
    staleTime: 5 * 60_000,
  });

  const isLoading =
    sessionStatus === "loading" ||
    (isSignedIn &&
      (watchlistQuery.isLoading ||
        episodeQuery.isLoading ||
        (candidates.length > 0 && itemsQuery.isLoading)));

  return {
    items: itemsQuery.data ?? [],
    isLoading,
    isSignedIn,
  };
}
