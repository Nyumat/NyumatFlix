"use client";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  isMovie,
  type MediaItem,
  type Movie,
  type TvShow,
} from "@/utils/typings";
import { useCallback, useEffect, useState } from "react";
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
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  const getItemLink = useCallback((item: MediaItem): string => {
    const movieItem = isMovie(item) ? (item as unknown as Movie) : null;
    const tvShowItem = !isMovie(item) ? (item as unknown as TvShow) : null;
    if (movieItem) return `/movies/${item.id}`;
    if (tvShowItem) return `/tvshows/${item.id}`;
    return `#invalid-item-${item.id}`;
  }, []);

  return (
    <div className="mx-4 md:mx-8">
      <ContentRowHeader title={title} href={href} />

      <div className="relative">
        <div className="grid grid-cols-4 gap-4">
          {items.map((item, index) => (
            <ContentCard
              key={`${item.id}-${index}`}
              item={item}
              isMobile={false}
              rating={item.content_rating || undefined}
              href={getItemLink(item)}
            />
          ))}
        </div>

        {hasMoreItems && (
          <div className="flex justify-center mt-8">
            {isLoadingMore ? (
              <LoadingSpinner size="lg" />
            ) : (
              <button
                onClick={async () => {
                  if (!onLoadMore || isLoadingMore) return;
                  setIsLoadingMore(true);
                  try {
                    const more = await onLoadMore();
                    if (more && more.length > 0) {
                      setItems((prev) => [...prev, ...more]);
                    }
                  } catch (error) {
                    console.error("Error loading more items:", error);
                  } finally {
                    setIsLoadingMore(false);
                  }
                }}
                className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-md text-sm text-accent-foreground transition-colors duration-200"
              >
                Load More
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualizedContentRow;
