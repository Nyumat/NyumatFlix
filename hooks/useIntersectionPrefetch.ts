import { useEffect, useRef } from "react";
import { usePrefetch } from "./usePrefetch";

interface IntersectionPrefetchOptions {
  /** How far from viewport to start prefetching (in pixels) */
  rootMargin?: string;
  /** Threshold for intersection (0-1) */
  threshold?: number;
  /** Whether to prefetch only once or continuously */
  once?: boolean;
}

export function useIntersectionPrefetch(
  href: string,
  mediaType?: "movie" | "tv",
  mediaId?: number,
  options: IntersectionPrefetchOptions = {},
) {
  const { rootMargin = "200px", threshold = 0.1, once = true } = options;

  const { prefetchRoute } = usePrefetch();
  const elementRef = useRef<HTMLDivElement>(null);
  const hasPrefetched = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && (!once || !hasPrefetched.current)) {
            prefetchRoute(href, {
              delay: 0, // No delay for viewport prefetching
              prefetchData: !!(mediaType && mediaId),
              mediaType,
              mediaId,
            });

            if (once) {
              hasPrefetched.current = true;
            }
          }
        });
      },
      {
        rootMargin,
        threshold,
      },
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [href, mediaType, mediaId, prefetchRoute, rootMargin, threshold, once]);

  return elementRef;
}
