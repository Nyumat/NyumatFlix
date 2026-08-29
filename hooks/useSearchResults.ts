"use client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchCombinedGenres, fetchSearchResults } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { CanonicalMediaCard } from "@/lib/domain/typings";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

export interface UseSearchResultsState {
  items: CanonicalMediaCard[];
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  selectedGenreIds: string[];
  allGenres: { [key: number]: string };
  genresLoading: boolean;
  currentQuery: string;
}

export interface UseSearchResultsComputed {
  filteredItems: CanonicalMediaCard[];
  genreOptions: Array<{ label: string; value: string }>;
}

export interface UseSearchResultsActions {
  setCurrentPage: (page: number) => void;
  setSelectedGenreIds: (ids: string[]) => void;
  refetch: () => void;
}

export interface UseSearchResultsReturn
  extends UseSearchResultsState,
    UseSearchResultsComputed,
    UseSearchResultsActions {}

export const useSearchResults = (query: string): UseSearchResultsReturn => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 300);
  const isDebouncing = trimmedQuery !== debouncedQuery;

  const genresQuery = useQuery({
    queryKey: queryKeys.combinedGenres(),
    queryFn: fetchCombinedGenres,
    staleTime: 30 * 60 * 1000, // 30 minutes - genres rarely change
  });

  const searchQuery = useQuery({
    queryKey: queryKeys.searchResults(debouncedQuery, currentPage),
    queryFn: () => fetchSearchResults(debouncedQuery, currentPage),
    enabled: !!debouncedQuery,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const items = useMemo(
    () => searchQuery.data?.media ?? [],
    [searchQuery.data],
  );

  const filteredItems = useMemo(() => {
    if (selectedGenreIds.length === 0) return items;
    return items.filter((item) =>
      item.genre_ids?.some((genreId) =>
        selectedGenreIds.includes(genreId.toString()),
      ),
    );
  }, [items, selectedGenreIds]);

  const genreOptions = useMemo(
    () =>
      Object.entries(genresQuery.data ?? {})
        .map(([id, name]) => ({
          label: name,
          value: id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [genresQuery.data],
  );

  const refetch = useCallback(() => {
    searchQuery.refetch();
  }, [searchQuery]);

  const [lastQuery, setLastQuery] = useState(debouncedQuery);
  if (debouncedQuery !== lastQuery) {
    setLastQuery(debouncedQuery);
    setCurrentPage(1);
  }

  return {
    items,
    currentPage,
    totalPages: searchQuery.data?.totalPages ?? 1,
    isLoading: isDebouncing || searchQuery.isLoading,
    isFetching: isDebouncing || searchQuery.isFetching,
    error: searchQuery.error?.message ?? null,
    selectedGenreIds,
    allGenres: genresQuery.data ?? {},
    genresLoading: genresQuery.isLoading,
    currentQuery: debouncedQuery,
    filteredItems,
    genreOptions,
    setCurrentPage,
    setSelectedGenreIds,
    refetch,
  };
};

export type UseSearchResults = typeof useSearchResults;
