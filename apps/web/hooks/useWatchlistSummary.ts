"use client";

import { useSignedInWatchlistEnabled } from "@/hooks/use-signed-in-watchlist-enabled";
import {
  summarizeWatchlist,
  watchlistQueryOptions,
} from "@/lib/watchlist/watchlist-queries";
import { useQuery } from "@tanstack/react-query";

export type { WatchlistSummary } from "@/lib/watchlist/watchlist-queries";

export function useWatchlistSummary(enabled: boolean) {
  const signedIn = useSignedInWatchlistEnabled(enabled);

  return useQuery({
    ...watchlistQueryOptions(),
    enabled: signedIn,
    select: summarizeWatchlist,
  });
}
