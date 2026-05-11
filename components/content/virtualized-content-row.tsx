"use client";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getHref } from "@/lib/cards";
import { hasPosterPath } from "@/lib/media-poster-path";
import { type MediaItem } from "@/utils/typings";
import { useEffect, useState } from "react";
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

  return (
    <div className="mx-4 md:mx-8">
      <ContentRowHeader title={title} href={href} />

      <div className="relative">
        <div className="grid grid-cols-4 gap-4">
          {items.filter(hasPosterPath).map((item, index) => (
            <ContentCard
              key={`${item.id}-${index}`}
              item={item}
              isMobile={false}
              rating={item.content_rating || undefined}
              href={getHref(item)}
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
                    const withPosters = more?.filter(hasPosterPath) ?? [];
                    if (withPosters.length > 0) {
                      setItems((prev) => [...prev, ...withPosters]);
                    }
                  } catch (error) {
                    console.error("Error loading more items:", error);
                  } finally {
                    setIsLoadingMore(false);
                  }
                }}
                className="px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded-lg ring-1 ring-primary/30 hover:ring-primary/50 shadow-lg shadow-primary/5 text-sm transition-all duration-200"
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
