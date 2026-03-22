"use client";

import { fetchCatalogNextPage } from "@/app/actions/fetch-catalog-next-page";
import { ContentGrid } from "@/components/content/media-content-grid";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { makeEntityKey } from "@/lib/catalog-page-dedupe";
import { filterWithPosterPath } from "@/lib/media-poster-path";
import type { MediaItem } from "@/utils/typings";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CatalogInfiniteGridProps = {
  mediaType: "movie" | "tv";
  initialItems: MediaItem[];
  initialPage: number;
  totalPages: number;
  queryParams: Record<string, string>;
};

type CatalogEntityStore = {
  entityMap: Map<string, MediaItem>;
  orderedKeys: string[];
};

const buildCatalogEntityStore = (
  items: MediaItem[],
  type: "movie" | "tv",
): CatalogEntityStore => {
  const seen = new Set<string>();
  const orderedKeys: string[] = [];
  const map = new Map<string, MediaItem>();
  for (const item of items) {
    const key = makeEntityKey(item.id, type);
    if (seen.has(key)) continue;
    seen.add(key);
    orderedKeys.push(key);
    map.set(key, item);
  }
  return { entityMap: map, orderedKeys };
};

export const CatalogInfiniteGrid = ({
  mediaType,
  initialItems,
  initialPage,
  totalPages,
  queryParams,
}: CatalogInfiniteGridProps) => {
  const [store, setStore] = useState<CatalogEntityStore>(() =>
    buildCatalogEntityStore(filterWithPosterPath(initialItems), mediaType),
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const queryKey = JSON.stringify(queryParams);

  useEffect(() => {
    setStore(
      buildCatalogEntityStore(filterWithPosterPath(initialItems), mediaType),
    );
    setCurrentPage(initialPage);
  }, [initialItems, initialPage, queryKey, mediaType]);

  const items = useMemo(
    () =>
      store.orderedKeys
        .map((k) => store.entityMap.get(k))
        .filter((item): item is MediaItem => item !== undefined),
    [store.entityMap, store.orderedKeys],
  );

  const fetchNextPage = useCallback(async () => {
    if (isLoading || currentPage >= totalPages) return;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;
      const data = await fetchCatalogNextPage(mediaType, queryParams, nextPage);
      const raw = filterWithPosterPath(data.results ?? []);

      setStore((prev) => {
        const nextMap = new Map(prev.entityMap);
        const existing = new Set(prev.orderedKeys);
        const appendedKeys: string[] = [];
        for (const item of raw) {
          const key = makeEntityKey(item.id, mediaType);
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
    } catch (error) {
      console.error("Catalog infinite scroll error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, isLoading, mediaType, queryParams, totalPages]);

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
    if (node) {
      observer.observe(node);
    }

    return () => {
      if (node) {
        observer.unobserve(node);
      }
    };
  }, [fetchNextPage]);

  return (
    <div className="space-y-6">
      <ContentGrid
        items={items}
        type={mediaType}
        showViewModeControls
        gridColumns="auto"
        showDock={false}
      />

      {currentPage < totalPages ? (
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner text="Loading more..." />
        </div>
      ) : null}

      {currentPage >= totalPages && items.length > 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          Showing {items.length} {mediaType === "movie" ? "movies" : "TV shows"}
          .
        </p>
      ) : null}
    </div>
  );
};
