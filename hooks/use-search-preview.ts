"use client";

import { useState, useEffect, useCallback } from "react";
import { debounce } from "lodash";

// Export the PreviewResult type
export type PreviewResult = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: string;
};

interface UseSearchPreviewProps {
  query: string;
  disablePreview: boolean;
  debounceMs?: number;
}

export function useSearchPreview({
  query,
  disablePreview,
  debounceMs = 300,
}: UseSearchPreviewProps) {
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchResults = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        setPreviewResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search-preview?query=${encodeURIComponent(searchQuery)}`,
        );
        if (!response.ok) {
          const errorData = await response.json();
          console.error(
            "Error fetching preview results:",
            errorData.error || response.statusText,
          );
          setPreviewResults([]);
        } else {
          const data: { results: PreviewResult[] } = await response.json();
          setPreviewResults(data.results || []);
        }
      } catch (error) {
        console.error("Error fetching preview results:", error);
        setPreviewResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [], // No dependencies, fetch itself doesn't change
  );

  const debouncedFetchResults = useCallback(
    debounce(fetchResults, debounceMs),
    [fetchResults, debounceMs], // Re-create debounce if fetchResults or debounceMs changes
  );

  useEffect(() => {
    if (!disablePreview && query && query.length >= 2) {
      debouncedFetchResults(query);
    } else {
      setPreviewResults([]);
      // If query becomes too short or preview is disabled, cancel any pending fetch
      debouncedFetchResults.cancel();
    }

    // Cleanup function to cancel debounce on unmount or when dependencies change significantly
    return () => {
      debouncedFetchResults.cancel();
    };
  }, [query, disablePreview, debouncedFetchResults]);

  return { previewResults, isLoadingPreview: isLoading };
}
