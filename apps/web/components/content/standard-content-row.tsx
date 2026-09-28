"use client";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { CatalogCarouselTileSkeleton } from "@/components/catalog/catalog-card-skeletons";
import useMedia from "@/hooks/useMedia";
import { cancelAllCardHoverPreviews } from "@/lib/card-hover-preview-coordinator";
import { getHref } from "@/lib/cards/selectors";
import {
  carouselItemClassName,
  filterCatalogCardArt,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { MediaItem } from "@/lib/domain/typings";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ContentCard } from "./content-card";
import { ContentRowHeader } from "./content-row-header";

interface ItemWithId {
  id: number;
}

export interface StandardContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  contentRating?: Record<number, string | null>;
  onLoadMore?: () => Promise<MediaItem[]>;
  hasMoreItems?: boolean;
  bleed?: boolean;
}

export function StandardContentRow({
  title,
  items: initialItems,
  href,
  contentRating = {},
  onLoadMore,
  hasMoreItems = false,
  bleed = false,
}: StandardContentRowProps) {
  const isMobile = useMedia("(max-width: 768px)", false);
  const catalogCardStyle = useCatalogCardStyle();
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const lastScrollProgressRef = useRef(0);

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
    if (!api || !hasMoreItems) return;

    const handleScroll = () => {
      cancelAllCardHoverPreviews();
      const scrollProgress = api.scrollProgress();
      lastScrollProgressRef.current = scrollProgress;

      if (scrollProgress > 0.85 && !loading && hasMoreItems) {
        loadMoreItems();
      }
    };

    api.on("scroll", handleScroll);

    return () => {
      api.off("scroll", handleScroll);
    };
  }, [api, hasMoreItems, loading]);

  const getContentRating = (item: MediaItem & ItemWithId) => {
    return item.content_rating || contentRating[item.id] || undefined;
  };

  const loadMoreItems = async () => {
    if (onLoadMore && hasMoreItems && !loading) {
      setLoading(true);
      try {
        const newItems = await onLoadMore();
        const withArt = filterCatalogCardArt(newItems ?? [], catalogCardStyle);
        if (withArt.length > 0) {
          setItems((prev) => [...prev, ...withArt]);
        }
      } catch (error) {
        console.error("Error loading more items:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <section className={cn(bleed && "index-bleed")}>
      <ContentRowHeader bleed={bleed} title={title} href={href} />

      <div className="relative">
        <Carousel
          opts={{
            align: "start",
            loop: false,
            dragFree: true,
            skipSnaps: true,
          }}
          setApi={setApi}
          className="w-full"
        >
          <CarouselContent
            viewportClassName={bleed ? "index-rail-padding" : "md:mx-0"}
            className="-ml-3 lg:-ml-4"
          >
            {filterCatalogCardArt(items, catalogCardStyle).map(
              (item, index) => (
                <CarouselItem
                  key={`${item.id}-${index}`}
                  className={carouselItemClassName(catalogCardStyle)}
                >
                  <ContentCard
                    item={item}
                    isMobile={!!isMobile}
                    rating={getContentRating(item)}
                    href={getHref(item)}
                  />
                </CarouselItem>
              ),
            )}

            {hasMoreItems && loading ? (
              <>
                {Array.from({ length: 2 }).map((_, index) => (
                  <CarouselItem
                    key={`loading-${index}`}
                    className={carouselItemClassName(catalogCardStyle)}
                    aria-hidden
                  >
                    <CatalogCarouselTileSkeleton style={catalogCardStyle} />
                  </CarouselItem>
                ))}
              </>
            ) : null}
          </CarouselContent>

          <CarouselPrevious
            className={cn(
              "absolute top-1/2 hidden -translate-y-1/2 border-0 bg-card/90 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-200 hover:bg-primary/20 md:inline-flex",
              bleed ? "md:left-2" : "md:left-0",
            )}
          />
          <CarouselNext
            className={cn(
              "absolute top-1/2 hidden -translate-y-1/2 border-0 bg-card/90 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-200 hover:bg-primary/20 md:inline-flex",
              bleed ? "md:right-2" : "md:right-0",
            )}
          />
        </Carousel>
      </div>
    </section>
  );
}
