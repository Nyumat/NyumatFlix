"use client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchSearchPreview, type SearchPreviewResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type PreviewResult = SearchPreviewResult;

interface UseSearchPreviewReturn {
  results: PreviewResult[];
  isLoading: boolean;
  error: string | null;
}

export function useSearchPreview(
  query: string,
  debounceMs = 300,
): UseSearchPreviewReturn {
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, debounceMs);
  const isDebouncing = trimmedQuery !== debouncedQuery;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.searchPreview(debouncedQuery),
    queryFn: ({ signal }) => fetchSearchPreview(debouncedQuery, signal),
    enabled: debouncedQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });

  const errorMessage = useMemo(() => {
    if (!error) return null;
    return "Failed to load search preview";
  }, [error]);

  return {
    results: data?.results ?? [],
    isLoading: isDebouncing || isLoading,
    error: errorMessage,
  };
}
