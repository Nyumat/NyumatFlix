"use client";

import { useSignedInWatchlistEnabled } from "@/hooks/use-signed-in-watchlist-enabled";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  selectWatchlistItem,
  watchlistQueryOptions,
} from "@/lib/watchlist/watchlist-queries";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

type UseWatchlistItemResult = {
  watchlistItem: WatchlistItem | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export function useWatchlistItem(
  contentId: number,
  mediaType: "movie" | "tv",
): UseWatchlistItemResult {
  const enabled = useSignedInWatchlistEnabled();

  const query = useQuery({
    ...watchlistQueryOptions(),
    enabled,
    select: (items) => selectWatchlistItem(items, contentId, mediaType),
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    watchlistItem: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}
