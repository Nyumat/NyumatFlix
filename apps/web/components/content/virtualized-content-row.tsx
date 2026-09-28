"use client";

import { CatalogGridTileSkeleton } from "@/components/catalog/catalog-card-skeletons";
import { getHref } from "@/lib/cards/selectors";
import {
  filterCatalogCardArt,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { cn } from "@/lib/utils";
import { type MediaItem } from "@/lib/domain/typings";
import { useEffect, useState } from "react";
import { ContentCard } from "./content-card";
import { ContentRowHeader } from "./content-row-header";

export interface VirtualizedContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  onLoadMore?: () => Promise<MediaItem[]>;
  hasMoreItems?: boolean;
  bleed?: boolean;
}

export function VirtualizedContentRow({
  title,
  items: initialItems,
  href,
  onLoadMore,
  hasMoreItems = false,
  bleed = false,
}: VirtualizedContentRowProps) {
  const catalogCardStyle = useCatalogCardStyle();
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
    <section className={cn(bleed && "index-bleed")}>
      <ContentRowHeader bleed={bleed} title={title} href={href} />

      <div className="relative">
        <div className={cn("grid-list", bleed && "index-rail-padding")}>
          {filterCatalogCardArt(items, catalogCardStyle).map((item, index) => (
            <div key={`${item.id}-${index}`} className="min-w-0">
              <ContentCard
                item={item}
                isMobile={false}
                rating={item.content_rating || undefined}
                href={getHref(item)}
              />
            </div>
          ))}
          {isLoadingMore
            ? Array.from({ length: 8 }).map((_, index) => (
                <div key={`loading-${index}`} className="min-w-0" aria-hidden>
                  <CatalogGridTileSkeleton style={catalogCardStyle} />
                </div>
              ))
            : null}
        </div>

        {hasMoreItems && (
          <div className="flex justify-center mt-8">
            {!isLoadingMore ? (
              <button
                onClick={async () => {
                  if (!onLoadMore || isLoadingMore) return;
                  setIsLoadingMore(true);
                  try {
                    const more = await onLoadMore();
                    const withArt = filterCatalogCardArt(
                      more ?? [],
                      catalogCardStyle,
                    );
                    if (withArt.length > 0) {
                      setItems((prev) => [...prev, ...withArt]);
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
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

export default VirtualizedContentRow;
