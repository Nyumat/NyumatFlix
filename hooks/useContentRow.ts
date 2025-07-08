import { MediaItem } from "@/utils/typings";
import { useEffect, useState } from "react";

interface UseContentRowOptions {
  rowId: string;
  count?: number;
  enrich?: boolean;
  hide?: boolean;
}

interface UseContentRowResult {
  items: MediaItem[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * I created this hook to fetch standardized content rows and ensure they have a minimum number of items.
 */
export function useContentRow({
  rowId,
  count = 20,
  enrich = false,
  hide = false,
}: UseContentRowOptions): UseContentRowResult {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchContentRow() {
      setIsLoading(true);
      setError(null);

      if (hide) {
        setIsLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          id: rowId,
          count: count.toString(),
          enrich: enrich.toString(),
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
  }, [rowId, count, enrich, hide]);

  return { items, isLoading, error };
}
