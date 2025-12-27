"use client";

import { fetchContentRow } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { MediaItem } from "@/utils/typings";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

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

export function useContentRow({
  rowId,
  count = 20,
  enrich = false,
  hide = false,
}: UseContentRowOptions): UseContentRowResult {
  const query = useQuery({
    queryKey: queryKeys.contentRow(rowId, { count, enrich }),
    queryFn: () => fetchContentRow(rowId, count, enrich),
    enabled: !hide,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
