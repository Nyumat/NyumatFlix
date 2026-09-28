"use client";

import { prefetchTrailerStream } from "@/hooks/use-videasy-trailer-stream";
import type { CardPreviewSource } from "@/lib/catalog-card-presentation";
import { loadYouTubeIframeApi } from "@/lib/youtube/iframe-api";
import { useEffect, useRef, type RefObject } from "react";

const PREFETCH_ROOT_MARGIN = "0px";

const sourceKeyOf = (source: CardPreviewSource | undefined): string | null => {
  if (!source) return null;
  if (source.kind === "youtube") {
    return source.youtubeKey ? `yt:${source.youtubeKey}` : null;
  }
  if (source.imdbId) return `tt:${source.imdbId}`;
  if (source.tmdbId && source.mediaType) {
    return `tmdb:${source.mediaType}:${source.tmdbId}`;
  }
  return null;
};

/**
 * Warms a card's trailer once it is actually visible on screen. With a zero
 * root margin and the default threshold, the observer only fires for cards
 * intersecting the viewport — and because intersection rects are clipped by
 * overflow ancestors, cards scrolled out of a carousel don't count. Only the
 * first intersection is acted on, and the underlying prefetch is
 * concurrency-bounded. Stream sources hit the shared `/api/trailers/videasy`
 * cache; YouTube sources just preload the IFrame API.
 */
export const useTrailerPrefetch = (
  ref: RefObject<HTMLElement | null>,
  source: CardPreviewSource | undefined,
  enabled: boolean,
): void => {
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const sourceKey = sourceKeyOf(source);

  useEffect(() => {
    if (!enabled || !sourceKey) {
      return;
    }
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }

    let handled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (handled || !entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        handled = true;
        observer.disconnect();

        const current = sourceRef.current;
        if (current?.kind === "stream") {
          prefetchTrailerStream(current);
        } else if (current?.kind === "youtube") {
          void loadYouTubeIframeApi();
        }
      },
      { rootMargin: PREFETCH_ROOT_MARGIN },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, sourceKey, ref]);
};
