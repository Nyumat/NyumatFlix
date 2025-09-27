import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ContentRowHeader } from "./content-row-header";

interface ContentRowSkeletonProps {
  title: string;
  href: string;
  count?: number;
}

/**
 * Server-compatible skeleton component for content rows - used as Suspense fallback
 * No client-side motion to prevent hydration errors
 */
export function ContentRowSkeleton({
  title,
  href,
  count = 10,
}: ContentRowSkeletonProps) {
  return (
    <div className="mx-4 md:mx-8">
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
            {Array.from({ length: count }).map((_, i) => (
              <CarouselItem
                key={i}
                className="pl-3 md:pl-4 basis-[40%] sm:basis-[28%] md:basis-[22%] lg:basis-[18%] xl:basis-[12%]"
              >
                <div className="w-full select-none min-h-[280px]">
                  <div className="relative overflow-hidden rounded-lg aspect-[2/3] group">
                    <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-xl animate-pulse">
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                    </div>
                  </div>
                  <div className="mt-2 text-foreground min-h-[68px]">
                    <div className="h-[20px] w-3/4 mb-1 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md leading-tight animate-pulse" />
                    <div className="flex items-center gap-2 text-xs mb-1 h-[16px]">
                      <div className="h-3 w-12 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm animate-pulse" />
                      <div className="h-3 w-8 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm animate-pulse" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[10px] h-[14px]">
                      <div className="h-[14px] w-8 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm animate-pulse" />
                      <div className="h-[14px] w-16 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm animate-pulse" />
                      <div className="h-[14px] w-12 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm animate-pulse" />
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
    </div>
  );
}
