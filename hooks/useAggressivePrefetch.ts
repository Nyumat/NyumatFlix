import { MediaItem, isMovie } from "@/utils/typings";
import { useEffect } from "react";
import { usePrefetch } from "./usePrefetch";

interface AggressivePrefetchOptions {
  /** Items to prefetch aggressively */
  items?: MediaItem[];
  /** Enable hover prefetching */
  enableHover?: boolean;
  /** Enable intersection observer prefetching */
  enableIntersection?: boolean;
  /** Prefetch popular routes immediately */
  enableImmediate?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
}

const POPULAR_ROUTES = ["/movies", "/tvshows", "/search", "/home"];

export function useAggressivePrefetch(options: AggressivePrefetchOptions = {}) {
  const {
    items = [],
    enableHover = true,
    enableIntersection = true,
    enableImmediate = true,
    rootMargin = "200px",
  } = options;

  const { prefetchRoute } = usePrefetch();

  // Immediately prefetch popular routes on page load
  useEffect(() => {
    if (!enableImmediate) return;

    const timer = setTimeout(() => {
      POPULAR_ROUTES.forEach((route) => {
        prefetchRoute(route, { delay: 0, prefetchData: false });
      });
    }, 1000); // Wait 1 second after initial load

    return () => clearTimeout(timer);
  }, [enableImmediate, prefetchRoute]);

  // Prefetch top items immediately
  useEffect(() => {
    if (!enableImmediate || !items.length) return;

    const timer = setTimeout(() => {
      // Prefetch top 5 items immediately
      items.slice(0, 5).forEach((item) => {
        const mediaType = isMovie(item) ? "movie" : "tv";
        const href = `/${mediaType === "movie" ? "movies" : "tvshows"}/${item.id}`;

        prefetchRoute(href, {
          delay: 0,
          prefetchData: true,
          mediaType,
          mediaId: item.id,
        });
      });
    }, 2000); // Wait 2 seconds for critical resources to load first

    return () => clearTimeout(timer);
  }, [items, enableImmediate, prefetchRoute]);

  return {
    prefetchRoute,
    // Expose utility for manual prefetching
    prefetchItem: (item: MediaItem) => {
      const mediaType = isMovie(item) ? "movie" : "tv";
      const href = `/${mediaType === "movie" ? "movies" : "tvshows"}/${item.id}`;

      prefetchRoute(href, {
        delay: 0,
        prefetchData: true,
        mediaType,
        mediaId: item.id,
      });
    },
  };
}
