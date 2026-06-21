"use client";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

export type WatchlistSummary = {
  total: number;
  watching: number;
  waiting: number;
  finished: number;
};

const emptySummary: WatchlistSummary = {
  total: 0,
  watching: 0,
  waiting: 0,
  finished: 0,
};

const summarizeWatchlist = (items: WatchlistItem[]): WatchlistSummary =>
  items.reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.status] += 1;
      return summary;
    },
    { ...emptySummary },
  );

async function fetchWatchlistSummary(): Promise<WatchlistSummary> {
  const response = await fetch("/api/watchlist");

  if (response.status === 401) {
    return emptySummary;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch watchlist summary");
  }

  const data = (await response.json()) as { items?: WatchlistItem[] };
  return summarizeWatchlist(data.items ?? []);
}

export function useWatchlistSummary(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.watchlistSummary(),
    queryFn: fetchWatchlistSummary,
    enabled,
    staleTime: 60_000,
  });
}
