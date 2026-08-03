"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PersonSearchResult = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for?: Array<{
    id: number;
    title?: string;
    name?: string;
    poster_path?: string | null;
    media_type: string;
  }>;
  known_for_department?: string;
};

type UsePeopleSearchOptions = {
  query: string;
  enabled?: boolean;
};

export function usePeopleSearch({
  query,
  enabled = true,
}: UsePeopleSearchOptions) {
  const trimmedQuery = query.trim();
  const [people, setPeople] = useState<PersonSearchResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(
    async (page: number, signal: AbortSignal) => {
      if (!trimmedQuery) {
        return { results: [] as PersonSearchResult[], page: 1, total_pages: 0 };
      }

      const url = new URL("/api/person-search", window.location.origin);
      url.searchParams.set("query", trimmedQuery);
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString(), { signal });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || "Failed to fetch people");
      }

      const json = (await res.json()) as {
        results: PersonSearchResult[];
        page: number;
        total_pages: number;
      };

      return {
        results: json.results ?? [],
        page: json.page ?? page,
        total_pages: json.total_pages ?? 0,
      };
    },
    [trimmedQuery],
  );

  useEffect(() => {
    if (!enabled || !trimmedQuery) {
      setPeople([]);
      setCurrentPage(1);
      setTotalPages(1);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    void (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { results, page, total_pages } = await fetchPage(
          1,
          controller.signal,
        );
        if (requestId !== requestIdRef.current) {
          return;
        }
        setPeople(results);
        setCurrentPage(page);
        setTotalPages(total_pages);
      } catch (loadError) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Unknown error",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [enabled, fetchPage, trimmedQuery]);

  const loadMore = useCallback(async () => {
    if (!trimmedQuery || isLoading || currentPage >= totalPages) {
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;
      const { results, page, total_pages } = await fetchPage(
        nextPage,
        controller.signal,
      );
      if (requestId !== requestIdRef.current) {
        return;
      }
      setPeople((prev) => [...prev, ...results]);
      setCurrentPage(page);
      setTotalPages(total_pages);
    } catch (loadError) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }
      setError(
        loadError instanceof Error ? loadError.message : "Unknown error",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, fetchPage, isLoading, totalPages, trimmedQuery]);

  return {
    trimmedQuery,
    people,
    currentPage,
    totalPages,
    isLoading,
    error,
    loadMore,
    hasMore: currentPage < totalPages,
  };
}
