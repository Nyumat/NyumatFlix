"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useContentRow } from "@/hooks/useContentRow";
import { AnimatePresence, motion } from "framer-motion";
import { ContentRow, ContentRowVariant } from "./content-row";
import { ContentRowHeader } from "./content-row-header";

export interface ContentRowLoaderProps {
  rowId: string;
  title: string;
  href: string;
  minCount?: number;
  variant?: ContentRowVariant;
  enrich?: boolean;
  hide?: boolean;
}

/**
 * Client-side component that loads a content row with a guaranteed minimum number of items
 */
export function ContentRowLoader({
  rowId,
  title,
  href,
  minCount = 20,
  variant = "standard",
  enrich = false,
  hide = false,
}: ContentRowLoaderProps) {
  const { items, isLoading, error } = useContentRow({
    rowId,
    count: minCount,
    enrich,
    hide,
  });

  if (hide) {
    return null;
  }

  if (isLoading) {
    return (
      <motion.div
        className="mx-4 md:mx-8 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
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
            <CarouselContent className="-ml-3 md:-ml-4">
              {Array.from({ length: Math.min(minCount, 10) }).map((_, i) => (
                <CarouselItem
                  key={i}
                  className="pl-3 md:pl-4 basis-[40%] sm:basis-[28%] md:basis-[22%] lg:basis-[18%] xl:basis-[12%]"
                >
                  <div className="w-full select-none min-h-[280px]">
                    <div className="relative overflow-hidden rounded-lg aspect-[2/3] group">
                      <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-xl">
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                      </div>
                    </div>

                    {/* Text content skeleton - exact typography match */}
                    <div className="mt-2 text-foreground min-h-[68px]">
                      {/* Title skeleton - matches h3 text-sm mb-1 leading-tight */}
                      <div className="h-[20px] w-3/4 mb-1 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md leading-tight" />

                      {/* Rating/Badge row - matches text-xs mb-1 */}
                      <div className="flex items-center gap-2 text-xs mb-1 h-[16px]">
                        <div className="h-3 w-12 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                        <div className="h-3 w-8 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                      </div>

                      {/* Genre/Year row - matches text-[10px] */}
                      <div className="flex flex-wrap items-center gap-1 text-[10px] h-[14px]">
                        <div className="h-[14px] w-8 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                        <div className="h-[14px] w-16 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                        <div className="h-[14px] w-12 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="absolute -left-3 md:-left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0" />
            <CarouselNext className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 border-0" />
          </Carousel>
        </div>
      </motion.div>
    );
  }

  // Show error or return ContentRow with items
  if (error) {
    console.error(
      `[ContentRowLoader] Error loading content row ${rowId}:`,
      error,
    );
    return (
      <motion.div
        className="space-y-4 py-4 px-4 md:px-6 lg:px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-red-500 text-sm">
          Failed to load {title}: {error.message}
        </div>
      </motion.div>
    );
  }

  if (items.length === 0) {
    console.warn(`[ContentRowLoader] No items found for row ${rowId}`);
    return (
      <motion.div
        className="space-y-4 py-4 px-4 md:px-6 lg:px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-muted-foreground text-sm">
          No content available for {title}
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.section
        id={rowId}
        className="my-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <ContentRow title={title} items={items} href={href} variant={variant} />
      </motion.section>
    </AnimatePresence>
  );
}
