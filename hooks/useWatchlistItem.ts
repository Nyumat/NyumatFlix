import { WatchlistItem } from "@/app/watchlist/actions";
import { useEffect, useState } from "react";

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

  const fetchWatchlistItem = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/watchlist/item?contentId=${contentId}&mediaType=${mediaType}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch watchlist item");
      }

      const data = await response.json();
      setWatchlistItem(data.item);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlistItem();
  }, [contentId, mediaType]);

  return {
    watchlistItem,
    isLoading,
    error,
    refetch: fetchWatchlistItem,
  };
}
