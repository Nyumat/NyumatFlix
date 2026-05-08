"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import useMedia from "@/hooks/useMedia";
import { filterWithPosterPath } from "@/lib/media-poster-path";
import { MediaItem } from "@/utils/typings";
import { ContentRowHeader } from "./content-row-header";
import { RankedBackdropCard } from "./ranked-backdrop-card";

export interface RankedContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
}

export function RankedContentRow({
  title,
  items: initialItems,
  href,
}: RankedContentRowProps) {
  const isMobile = useMedia("(max-width: 768px)", false);
  const items = filterWithPosterPath(initialItems).slice(0, 3);

  if (isMobile) {
    return (
      <div>
        <ContentRowHeader title={title} href={href} />
        <div className="relative">
          <Carousel
            opts={{
              align: "start",
              loop: false,
              dragFree: true,
              skipSnaps: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-3">
              {items.map((item, index) => (
                <CarouselItem
                  key={`${item.id}-${index}`}
                  className="pl-3 md:pl-4 basis-[85%] sm:basis-[70%]"
                >
                  <RankedBackdropCard item={item} rank={index + 1} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute -left-3 top-1/2 -translate-y-1/2 bg-card/90 backdrop-blur-md hover:bg-primary/20 border-0 shadow-lg shadow-black/20 transition-all duration-200" />
            <CarouselNext className="absolute -right-3 top-1/2 -translate-y-1/2 bg-card/90 backdrop-blur-md hover:bg-primary/20 border-0 shadow-lg shadow-black/20 transition-all duration-200" />
          </Carousel>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ContentRowHeader title={title} href={href} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {items.map((item, index) => (
          <RankedBackdropCard
            key={`${item.id}-${index}`}
            item={item}
            rank={index + 1}
          />
        ))}
      </div>
    </div>
  );
}
