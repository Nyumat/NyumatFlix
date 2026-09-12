"use client";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import useMedia from "@/hooks/useMedia";
import { getHref } from "@/lib/cards/selectors";
import { MediaItem } from "@/lib/domain/typings";
import { useEffect, useRef, useState } from "react";
import { hasPosterPath } from "@/lib/media-poster-path";
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
        const withPosters = newItems?.filter(hasPosterPath) ?? [];
        if (withPosters.length > 0) {
          setItems((prev) => [...prev, ...withPosters]);
        }
      } catch (error) {
        console.error("Error loading more items:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const LoadingComponent = () => (
    <div className="flex items-center justify-center min-h-[150px] w-full">
      <LoadingSpinner size="lg" />
    </div>
  );

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
            {items.filter(hasPosterPath).map((item, index) => (
              <CarouselItem
                key={`${item.id}-${index}`}
                className="pl-3 basis-[46%] sm:basis-[31%] md:basis-[24%] lg:pl-4 lg:basis-[11rem] xl:basis-[12rem] 2xl:basis-[13rem]"
              >
                <ContentCard
                  item={item}
                  isMobile={!!isMobile}
                  rating={getContentRating(item)}
                  href={getHref(item)}
                />
              </CarouselItem>
            ))}

            {hasMoreItems && loading && (
              <CarouselItem className="flex items-center justify-center pl-3 basis-[46%] sm:basis-[31%] md:basis-[24%] lg:pl-4 lg:basis-[11rem] xl:basis-[12rem] 2xl:basis-[13rem]">
                <LoadingComponent />
              </CarouselItem>
            )}
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
