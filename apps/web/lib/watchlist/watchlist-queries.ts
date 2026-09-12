import type { WatchlistItem } from "@/lib/domain/watchlist";
import { queryStaleTime } from "@/lib/cache-policy";
import { queryKeys } from "@/lib/query-keys";

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

export const summarizeWatchlist = (items: WatchlistItem[]): WatchlistSummary =>
  items.reduce(
    (summary, item) => {
      summary.total += 1;
      if (item.status === "watching") {
        summary.watching += 1;
      } else if (item.status === "plan_to_watch" || item.status === "on_hold") {
        summary.waiting += 1;
      } else if (item.status === "completed" || item.status === "dropped") {
        summary.finished += 1;
      }
      return summary;
    },
    { ...emptySummary },
  );

export async function fetchWatchlistItems(): Promise<WatchlistItem[]> {
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

export const watchlistQueryOptions = () => ({
  queryKey: queryKeys.watchlist(),
  queryFn: fetchWatchlistItems,
  staleTime: queryStaleTime(60_000),
  refetchOnWindowFocus: false as const,
  refetchOnMount: false as const,
});

export const selectWatchlistItem = (
  items: WatchlistItem[] | undefined,
  contentId: number,
  mediaType: "movie" | "tv",
): WatchlistItem | null =>
  items?.find(
    (item) => item.contentId === contentId && item.mediaType === mediaType,
  ) ?? null;
