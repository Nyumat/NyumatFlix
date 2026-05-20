"use client";

import {
  getMediaAboveFoldApiHref,
  getMediaAboveFoldImageUrls,
  type MediaAboveFoldDetail,
  type MediaAboveFoldType,
} from "@/lib/media-above-fold";
import { getHref } from "@/lib/cards";
import { queryKeys } from "@/lib/query-keys";
import type { CanonicalMediaCard, MediaItem } from "@/utils/typings";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

const warmed = new Set<string>();
const pending = new Map<string, Promise<MediaAboveFoldDetail | null>>();

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
    .catch(() => null);

  pending.set(cacheKey, promise);
  return promise;
}

export function useMediaCardPrefetch(
  item: CanonicalMediaCard | MediaItem,
  href?: string,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetch = useCallback(() => {
    const mediaType = getMediaType(item);
    if (!mediaType) return;

    const link = href || getHref(item);
    if (!isInternalHref(link)) return;
    const cacheKey = `${mediaType}:${item.id}`;
    router.prefetch(link);

    if (warmed.has(cacheKey)) return;
    warmed.add(cacheKey);

    void fetchAboveFold(mediaType, item.id).then((detail) => {
      if (!detail) return;
      queryClient.setQueryData(
        queryKeys.mediaAboveFold(mediaType, String(item.id)),
        detail,
      );
      queryClient.setQueryData(
        mediaType === "movie"
          ? queryKeys.movieDetails(Number(item.id))
          : queryKeys.tvDetails(Number(item.id)),
        detail,
      );
      for (const url of getMediaAboveFoldImageUrls(detail)) {
        preloadImage(url);
      }
    });
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

  return {
    prefetch,
    schedulePrefetch,
    cancelPrefetch,
  };
}
