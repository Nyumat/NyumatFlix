"use client";

import { fetchSeasonDetailsForCatalog } from "@/components/tvshow/tvshow-api";
import {
  getMediaAboveFoldApiHref,
  getMediaAboveFoldImageUrls,
  type MediaAboveFoldDetail,
  type MediaAboveFoldType,
} from "@/lib/media-above-fold";
import { queryStaleTime } from "@/lib/cache-policy";
import { getHref } from "@/lib/cards/selectors";
import { queryKeys } from "@/lib/query-keys";
import {
  resolveAnimePrefetchRouteId,
  resolveTvDetailCatalogFromHref,
} from "@/lib/tv-detail-catalog";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import {
  normalizeTvContentKey,
  resolveLocalTvWatchCoords,
} from "@/lib/tv-watch-target";
import { QueryClientContext } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useRef } from "react";

const warmed = new Set<string>();
const warmedSeasons = new Set<string>();
const pending = new Map<string, Promise<MediaAboveFoldDetail | null>>();
const MAX_WARMED_ITEMS = 250;

function rememberWarmed(cacheKey: string, bucket: Set<string>) {
  if (bucket.has(cacheKey)) return;
  bucket.add(cacheKey);

  if (bucket.size <= MAX_WARMED_ITEMS) return;
  const oldest = bucket.values().next().value;
  if (oldest) bucket.delete(oldest);
}

const resolveDefaultPrefetchSeason = (contentId: number | null): number => {
  if (contentId === null) {
    return 1;
  }

  return resolveLocalTvWatchCoords(contentId)?.seasonNumber ?? 1;
};

function getMediaType(
  item: CanonicalMediaCard | MediaItem,
): MediaAboveFoldType | null {
  if (item.media_type === "movie" || item.media_type === "tv") {
    return item.media_type;
  }
  if (!("title" in item) && "name" in item && item.name) {
    return "tv";
  }
  if ("title" in item && item.title) {
    return "movie";
  }
  return null;
}

function preloadImage(url: string) {
  if (typeof window === "undefined") return;
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  image.src = url;
}

const isInternalHref = (href: string) => href.startsWith("/");

async function fetchAboveFold(
  mediaType: MediaAboveFoldType,
  id: number | string,
) {
  const cacheKey = `${mediaType}:${id}`;
  const existing = pending.get(cacheKey);
  if (existing) return existing;

  const promise = fetch(getMediaAboveFoldApiHref(mediaType, id), {
    priority: "low",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      return (await response.json()) as MediaAboveFoldDetail;
    })
    .catch(() => null)
    .finally(() => {
      pending.delete(cacheKey);
    });

  pending.set(cacheKey, promise);
  return promise;
}

function getPrefetchId(
  item: CanonicalMediaCard | MediaItem,
  link: string,
): number | string {
  const animeRouteId = resolveAnimePrefetchRouteId(link);
  if (animeRouteId) {
    return animeRouteId;
  }

  const animeItem = item as MediaItem & {
    isAniListFallback?: boolean;
    sourceAnilistId?: number;
  };

  if (animeItem.isAniListFallback) {
    const match = link.match(/\/tvshows\/(anilist-\d+)/);
    if (match?.[1]) return match[1];
    if (
      typeof animeItem.sourceAnilistId === "number" &&
      Number.isInteger(animeItem.sourceAnilistId)
    ) {
      return `anilist-${Math.abs(animeItem.sourceAnilistId)}`;
    }
  }

  return item.id;
}

export function useMediaCardPrefetch(
  item: CanonicalMediaCard | MediaItem,
  href?: string,
) {
  const router = useRouter();
  const queryClient = useContext(QueryClientContext);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetch = useCallback(() => {
    const mediaType = getMediaType(item);
    if (!mediaType) return;

    const link = href || getHref(item);
    if (!isInternalHref(link)) return;
    const prefetchId = getPrefetchId(item, link);
    const cacheKey = `${mediaType}:${prefetchId}`;
    router.prefetch(link);

    if (!queryClient) return;

    if (!warmed.has(cacheKey)) {
      void fetchAboveFold(mediaType, prefetchId).then((detail) => {
        if (!detail) return;
        rememberWarmed(cacheKey, warmed);
        queryClient.setQueryData(
          queryKeys.mediaAboveFold(mediaType, String(prefetchId)),
          detail,
        );
        for (const url of getMediaAboveFoldImageUrls(detail)) {
          preloadImage(url);
        }
      });
    }

    if (mediaType !== "tv") {
      return;
    }

    const tvRouteId = String(prefetchId);
    const contentId = normalizeTvContentKey(prefetchId);
    const seasonNumber = resolveDefaultPrefetchSeason(contentId);
    const seasonWarmKey = `${tvRouteId}:season:${seasonNumber}`;
    if (warmedSeasons.has(seasonWarmKey)) {
      return;
    }

    const catalog = resolveTvDetailCatalogFromHref(link);
    void queryClient
      .prefetchQuery({
        queryKey: queryKeys.tvSeasonRoute(tvRouteId, seasonNumber),
        queryFn: () =>
          fetchSeasonDetailsForCatalog(tvRouteId, seasonNumber, catalog),
        staleTime: queryStaleTime(60 * 60 * 1000),
      })
      .then(() => {
        rememberWarmed(seasonWarmKey, warmedSeasons);
      })
      .catch(() => undefined);
  }, [href, item, queryClient, router]);

  const schedulePrefetch = useCallback(() => {
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      prefetch();
    }, 120);
  }, [prefetch]);

  const cancelPrefetch = useCallback(() => {
    if (!timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  useEffect(() => cancelPrefetch, [cancelPrefetch]);

  return {
    prefetch,
    schedulePrefetch,
    cancelPrefetch,
  };
}
