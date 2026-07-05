"use client";

import { useCallback, useEffect, useState } from "react";

const SEARCH_RECENTS_KEY = "nyumatflix.search.recents";
const MAX_RECENT_SEARCHES = 3;

export function useSearchRecents(enabled: boolean) {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const storedRecentSearches =
      window.localStorage.getItem(SEARCH_RECENTS_KEY);
    if (!storedRecentSearches) {
      return;
    }

    try {
      const parsedRecentSearches = JSON.parse(storedRecentSearches);
      if (Array.isArray(parsedRecentSearches)) {
        setRecentSearches(
          parsedRecentSearches
            .filter((recentSearch) => typeof recentSearch === "string")
            .slice(0, MAX_RECENT_SEARCHES),
        );
      }
    } catch {
      window.localStorage.removeItem(SEARCH_RECENTS_KEY);
    }
  }, [enabled]);

  const saveRecentSearch = useCallback((trimmedQuery: string) => {
    setRecentSearches((currentRecentSearches) => {
      const nextRecentSearches = [
        trimmedQuery,
        ...currentRecentSearches.filter(
          (recentSearch) =>
            recentSearch.toLowerCase() !== trimmedQuery.toLowerCase(),
        ),
      ].slice(0, MAX_RECENT_SEARCHES);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          SEARCH_RECENTS_KEY,
          JSON.stringify(nextRecentSearches),
        );
      }

      return nextRecentSearches;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SEARCH_RECENTS_KEY);
    }
  }, []);

  return {
    recentSearches,
    saveRecentSearch,
    clearRecentSearches,
  };
}
