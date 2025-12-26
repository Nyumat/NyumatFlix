"use client";

import { debounce } from "lodash";
import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/utils";

/**
 * Preview result type for search suggestions
 */
export type PreviewResult = {
  /** Unique identifier for the media item */
  id: number;
  /** Title for movies */
  title?: string;
  /** Name for TV shows */
  name?: string;
  /** Poster image path */
  poster_path: string | null;
  /** Media type (movie, tv, person) */
  media_type: string;
  /** Release date for movies */
  release_date?: string;
  /** First air date for TV shows */
  first_air_date?: string;
  /** Array of genre names */
  genre_names?: string[];
};

/**
 * Return type for the useSearchPreview hook
 */
interface UseSearchPreviewReturn {
  /** Array of search preview results */
  results: PreviewResult[];
  /** Whether a search request is currently loading */
  isLoading: boolean;
  /** Error message if search fails */
  error: string | null;
}

/**
 * Custom hook for fetching search preview results with debouncing
 * Provides real-time search suggestions as the user types
 * @param query - Search query string
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns Search preview state and results
 */
export function useSearchPreview(
  query: string,
  debounceMs: number = 300,
): UseSearchPreviewReturn {
  const [results, setResults] = useState<PreviewResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentQueryRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    currentQueryRef.current = searchQuery;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/search-preview?query=${encodeURIComponent(searchQuery)}`,
        { signal: abortController.signal },
      );

      if (
        abortController.signal.aborted ||
        currentQueryRef.current !== searchQuery
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error("Search preview failed");
      }

      const data = await response.json();

      if (
        currentQueryRef.current === searchQuery &&
        !abortController.signal.aborted
      ) {
        setResults(data.results || []);
      }
    } catch (err) {
      if (
        abortController.signal.aborted ||
        currentQueryRef.current !== searchQuery
      ) {
        return;
      }

      const isAbortError =
        (err instanceof Error && err.name === "AbortError") ||
        (err instanceof DOMException && err.name === "AbortError");

      if (isAbortError) {
        return;
      }

      if (currentQueryRef.current === searchQuery) {
        logger.error("Error fetching preview results", err);
        setError("Failed to load search suggestions");
        setResults([]);
      }
    } finally {
      if (
        currentQueryRef.current === searchQuery &&
        !abortController.signal.aborted
      ) {
        setIsLoading(false);
      }
    }
  }, []);

  const debouncedFetch = useCallback(
    debounce((searchQuery: string) => {
      fetchResults(searchQuery);
    }, debounceMs),
    [fetchResults, debounceMs],
  );

  useEffect(() => {
    if (query.trim()) {
      debouncedFetch(query);
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      currentQueryRef.current = "";
      setResults([]);
      setIsLoading(false);
      setError(null);
    }

    return () => {
      debouncedFetch.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [query, debouncedFetch]);

  return {
    results,
    isLoading,
    error,
  };
}
