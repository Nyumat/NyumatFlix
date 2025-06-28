import { useState, useEffect } from "react";
import { MediaItem } from "@/utils/typings";

interface UseContentRowOptions {
  rowId: string;
  count?: number;
  enrich?: boolean;
  globalCache?: boolean;
}

interface UseContentRowResult {
  items: MediaItem[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching standardized content rows with a guaranteed minimum number of items
 */
export function useContentRow({
  rowId,
  count = 20,
  enrich = false,
  globalCache = true,
}: UseContentRowOptions): UseContentRowResult {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchContentRow() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          id: rowId,
          count: count.toString(),
          enrich: enrich.toString(),
          globalCache: globalCache.toString(),
        });

        const response = await fetch(`/api/content-rows?${params}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch content row: ${response.status}`);
        }

        const data = await response.json();
        setItems(data);
      } catch (err) {
        console.error(`Error fetching content row ${rowId}:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }

    fetchContentRow();
  }, [rowId, count, enrich, globalCache]);

  return { items, isLoading, error };
}
