"use client";

import { useCallback, useState } from "react";

const MAX_RECENT_SEARCHES = 6;

let sessionRecentSearches: string[] = [];

export function useSearchRecents(enabled: boolean) {
  const [recentSearches, setRecentSearches] = useState<string[]>(
    enabled ? sessionRecentSearches : [],
  );

  const saveRecentSearch = useCallback(
    (trimmedQuery: string) => {
      if (!enabled) {
        return;
      }

      setRecentSearches((currentRecentSearches) => {
        const nextRecentSearches = [
          trimmedQuery,
          ...currentRecentSearches.filter(
            (recentSearch) =>
              recentSearch.toLowerCase() !== trimmedQuery.toLowerCase(),
          ),
        ].slice(0, MAX_RECENT_SEARCHES);

        sessionRecentSearches = nextRecentSearches;
        return nextRecentSearches;
      });
    },
    [enabled],
  );

  const clearRecentSearches = useCallback(() => {
    sessionRecentSearches = [];
    setRecentSearches([]);
  }, []);

  return {
    recentSearches,
    saveRecentSearch,
    clearRecentSearches,
  };
}
