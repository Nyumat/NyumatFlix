import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

interface PrefetchOptions {
  /** Delay before prefetching starts (ms) */
  delay?: number;
  /** Whether to prefetch API data along with the route */
  prefetchData?: boolean;
  /** Media type for API prefetching */
  mediaType?: "movie" | "tv";
  /** Media ID for API prefetching */
  mediaId?: number;
}

const prefetchedRoutes = new Set<string>();
const prefetchedApiData = new Set<string>();

export function usePrefetch() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const prefetchRoute = useCallback(
    (href: string, options: PrefetchOptions = {}) => {
      const { delay = 150, prefetchData = true, mediaType, mediaId } = options;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        // Prefetch the route if not already prefetched
        if (!prefetchedRoutes.has(href)) {
          router.prefetch(href);
          prefetchedRoutes.add(href);
        }

        // Prefetch API data if requested and not already prefetched
        if (prefetchData && mediaType && mediaId) {
          const apiKey = `${mediaType}-${mediaId}`;
          if (!prefetchedApiData.has(apiKey)) {
            // Prefetch the main media data
            fetch(`/api/${mediaType === "movie" ? "movies" : "tv"}/${mediaId}`)
              .then((response) => response.json())
              .catch(() => {}); // Silent fail for prefetching

            // Prefetch recommendations as well for a more complete experience
            fetch(
              `/api/${mediaType === "movie" ? "movies" : "tv"}/${mediaId}/recommendations`,
            )
              .then((response) => response.json())
              .catch(() => {}); // Silent fail for prefetching

            prefetchedApiData.add(apiKey);
          }
        }
      }, delay);
    },
    [router],
  );

  const cancelPrefetch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    prefetchRoute,
    cancelPrefetch,
    cleanup,
  };
}
