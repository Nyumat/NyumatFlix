import { WatchlistItem } from "@/lib/domain/watchlist";
import { useCallback, useEffect, useState } from "react";

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
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWatchlistItem = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/watchlist/item?contentId=${contentId}&mediaType=${mediaType}`,
          { signal },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch watchlist item");
        }

        const data = await response.json();
        setWatchlistItem(data.item);
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [contentId, mediaType],
  );

  const refetch = useCallback(() => fetchWatchlistItem(), [fetchWatchlistItem]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchWatchlistItem(controller.signal);
    return () => controller.abort();
  }, [fetchWatchlistItem]);

  return {
    watchlistItem,
    isLoading,
    error,
    refetch,
  };
}
