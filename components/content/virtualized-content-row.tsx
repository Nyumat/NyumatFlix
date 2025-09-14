"use client";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import useMedia from "@/hooks/useMedia";
import {
  isMovie,
  type MediaItem,
  type Movie,
  type TvShow,
} from "@/utils/typings";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grid } from "react-window";
import { ContentCard } from "./content-card";
import { ContentRowHeader } from "./content-row-header";

export interface VirtualizedContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  onLoadMore?: () => Promise<MediaItem[]>;
  hasMoreItems?: boolean;
}

export function VirtualizedContentRow({
  title,
  items: initialItems,
  href,
  onLoadMore,
  hasMoreItems = false,
}: VirtualizedContentRowProps) {
  const isMdUp = useMedia("(min-width: 768px)", true);
  const isLgUp = useMedia("(min-width: 1024px)", true);
  const isXlUp = useMedia("(min-width: 1280px)", true);

  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (
      initialItems.length > 0 &&
      items.length > 0 &&
      initialItems[0].id !== items[0].id
    ) {
      setItems(initialItems);
    } else if (initialItems.length > 0 && items.length === 0) {
      setItems(initialItems);
    }
  }, [initialItems, items]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const itemWidth = useMemo(() => {
    if (!isMdUp) return Math.max(200, Math.floor(containerWidth * 0.6));
    if (isXlUp) return 220; // xl and up
    if (isLgUp) return 200; // lg
    return 180; // md
  }, [containerWidth, isMdUp, isLgUp, isXlUp]);

  const itemGap = 16; // px gap between items
  const itemSize = itemWidth + itemGap; // react-window item size (includes gap)

  // approximate card height based on 2/3 aspect poster + text
  const listHeight = useMemo(() => {
    const posterHeight = Math.round((itemWidth * 3) / 2);
    const metaHeight = 90; // title/badges/buttons
    return posterHeight + metaHeight;
  }, [itemWidth]);

  const getItemLink = useCallback((item: MediaItem): string => {
    const movieItem = isMovie(item) ? (item as unknown as Movie) : null;
    const tvShowItem = !isMovie(item) ? (item as unknown as TvShow) : null;
    if (movieItem) return `/movies/${item.id}`;
    if (tvShowItem) return `/tvshows/${item.id}`;
    return `#invalid-item-${item.id}`;
  }, []);

  const handleCellsRendered = useCallback(
    async (
      visibleCells: {
        columnStartIndex: number;
        columnStopIndex: number;
        rowStartIndex: number;
        rowStopIndex: number;
      },
      _allCells: {
        columnStartIndex: number;
        columnStopIndex: number;
        rowStartIndex: number;
        rowStopIndex: number;
      },
    ) => {
      if (!hasMoreItems || !onLoadMore || isLoadingMore) return;
      const nearEndThreshold = Math.max(items.length - 5, 0);
      if (visibleCells.columnStopIndex >= nearEndThreshold) {
        setIsLoadingMore(true);
        try {
          const more = await onLoadMore();
          if (more && more.length > 0) {
            setItems((prev) => [...prev, ...more]);
          }
        } catch {
          // we could log here if needed
        } finally {
          setIsLoadingMore(false);
        }
      }
    },
    [hasMoreItems, onLoadMore, isLoadingMore, items.length],
  );

  // Note: itemKey functionality removed as it's not supported in react-window v2 List component

  return (
    <div className="mx-4 md:mx-8 mb-8">
      <ContentRowHeader title={title} href={href} />

      <div className="relative" ref={containerRef}>
        {containerWidth > 0 ? (
          <Grid
            cellComponent={({ columnIndex, style }) => {
              const item = items[columnIndex];
              if (!item) return null;
              return (
                <div style={style} className="pl-3 md:pl-4">
                  <div style={{ width: itemWidth }}>
                    <ContentCard
                      item={item}
                      isMobile={false}
                      rating={item.content_rating || undefined}
                      href={getItemLink(item)}
                    />
                  </div>
                </div>
              );
            }}
            cellProps={{}}
            columnCount={items.length}
            columnWidth={itemSize}
            rowCount={1}
            rowHeight={listHeight}
            overscanCount={2}
            onCellsRendered={handleCellsRendered}
            className="[&>div]:items-stretch"
            style={{ width: containerWidth, height: listHeight }}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[200px]">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {hasMoreItems && isLoadingMore && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualizedContentRow;
