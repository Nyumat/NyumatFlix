"use client";

import { fetchSearchPreview, type SearchPreviewResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo } from "react";

export type PreviewResult = SearchPreviewResult;

interface UseSearchPreviewReturn {
  results: PreviewResult[];
  isLoading: boolean;
  error: string | null;
}

export function useSearchPreview(
  query: string,
  _debounceMs: number = 300,
): UseSearchPreviewReturn {
  const deferredQuery = useDeferredValue(query.trim());

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.searchPreview(deferredQuery),
    queryFn: ({ signal }) => fetchSearchPreview(deferredQuery, signal),
    enabled: deferredQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });

  const errorMessage = useMemo(() => {
    if (!error) return null;
    return "Failed to load search suggestions";
  }, [error]);

  return {
    results: data ?? [],
    isLoading,
    error: errorMessage,
  };
}
