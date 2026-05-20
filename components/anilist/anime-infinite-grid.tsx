"use client";

import { fetchAnimeNextPage } from "@/app/actions/fetch-anime-next-page";
import { MediaContentGrid } from "@/components/content/media-content-grid";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { AniListSearchParams } from "@/lib/anilist";
import { filterWithPosterPath } from "@/lib/media-poster-path";
import type { MediaItem } from "@/utils/typings";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AnimeInfiniteGridProps = {
  initialItems: MediaItem[];
  initialPage: number;
  initialHasNextPage: boolean;
  params: AniListSearchParams;
};

type AnimeEntityStore = {
  entityMap: Map<string, MediaItem>;
  orderedKeys: string[];
};

const getAnimeItemKey = (item: MediaItem) => {
  if ("sourceAnilistId" in item && typeof item.sourceAnilistId === "number") {
    return `anilist:${item.sourceAnilistId}`;
  }
  return `${item.media_type ?? "tv"}:${item.id}`;
};

const buildAnimeEntityStore = (items: MediaItem[]): AnimeEntityStore => {
  const seen = new Set<string>();
  const orderedKeys: string[] = [];
  const map = new Map<string, MediaItem>();

  for (const item of items) {
    const key = getAnimeItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    orderedKeys.push(key);
    map.set(key, item);
  }

  return { entityMap: map, orderedKeys };
};

export const AnimeInfiniteGrid = ({
  initialItems,
  initialPage,
  initialHasNextPage,
  params,
}: AnimeInfiniteGridProps) => {
  const [store, setStore] = useState<AnimeEntityStore>(() =>
    buildAnimeEntityStore(filterWithPosterPath(initialItems)),
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    setStore(buildAnimeEntityStore(filterWithPosterPath(initialItems)));
    setCurrentPage(initialPage);
    setHasNextPage(initialHasNextPage);
  }, [initialItems, initialPage, initialHasNextPage, paramsKey]);

  const items = useMemo(
    () =>
      store.orderedKeys
        .map((key) => store.entityMap.get(key))
        .filter((item): item is MediaItem => item !== undefined),
    [store.entityMap, store.orderedKeys],
  );

  const fetchNextPage = useCallback(async () => {
    if (isLoading || !hasNextPage) return;

    try {
      setIsLoading(true);
      const data = await fetchAnimeNextPage(params, currentPage + 1);
      const raw = filterWithPosterPath(data.results ?? []);

      setStore((prev) => {
        const nextMap = new Map(prev.entityMap);
        const existing = new Set(prev.orderedKeys);
        const appendedKeys: string[] = [];

        for (const item of raw) {
          const key = getAnimeItemKey(item);
          nextMap.set(key, item);
          if (!existing.has(key)) {
            existing.add(key);
            appendedKeys.push(key);
          }
        }

        return {
          entityMap: nextMap,
          orderedKeys: [...prev.orderedKeys, ...appendedKeys],
        };
      });
      setCurrentPage(data.page);
      setHasNextPage(data.hasNextPage);
    } catch (error) {
      console.error("Anime infinite scroll error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, hasNextPage, isLoading, params]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    const node = sentinelRef.current;
    if (node) observer.observe(node);

    return () => {
      if (node) observer.unobserve(node);
    };
  }, [fetchNextPage]);

  return (
    <div className="space-y-6">
      <MediaContentGrid
        items={items}
        showViewModeControls
        gridColumns="auto"
        showDock={false}
      />

      {hasNextPage ? (
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner text="Loading more..." />
        </div>
      ) : null}

      {!hasNextPage && items.length > 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          Showing {items.length} anime.
        </p>
      ) : null}
    </div>
  );
};
