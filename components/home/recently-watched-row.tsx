"use client";

import { RecentlyWatchedRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { RecentlyWatchedCard } from "@/components/home/recently-watched-card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useRecentlyWatched } from "@/hooks/use-recently-watched";
import type { RecentlyWatchedScope } from "@/lib/playback/recently-watched";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type RecentlyWatchedRowProps = {
  scope?: RecentlyWatchedScope;
};

export function RecentlyWatchedRow({ scope = "all" }: RecentlyWatchedRowProps) {
  const { items, isLoading, isSignedIn } = useRecentlyWatched(scope);
  const [api, setApi] = useState<CarouselApi>();
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!api) return;

    const sync = () => {
      const snaps = api.scrollSnapList();
      setPageCount(snaps.length);
      setPageIndex(api.selectedScrollSnap());
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    sync();
    api.on("select", sync);
    api.on("reInit", sync);

    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api, items.length]);

  if (isLoading) {
    return <RecentlyWatchedRowFallback />;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Continue watching"
      className="animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both"
    >
      <Carousel
        opts={{
          align: "start",
          slidesToScroll: "auto",
          dragFree: true,
        }}
        setApi={setApi}
      >
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md p-2 pr-3 md:justify-start md:gap-4 md:pr-4">
          <div className="min-w-0 flex-1 md:mr-32">
            <h2 className="truncate text-lg font-medium md:text-base">
              Continue Watching
            </h2>
          </div>

          {isSignedIn ? (
            <Link
              href="/watchlist"
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "ml-auto shrink-0",
              )}
              prefetch={false}
            >
              Watchlist
            </Link>
          ) : null}

          <div
            className={cn(
              "hidden shrink-0 items-center gap-2 md:flex",
              !isSignedIn && "ml-auto",
              isSignedIn && "ml-4",
            )}
          >
            {pageCount > 0 ? (
              <p
                className="mr-4 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <span className="font-bold text-foreground">
                  {pageIndex + 1}
                </span>
                <span> / </span>
                <span>{pageCount}</span>
              </p>
            ) : null}

            <Button
              type="button"
              disabled={!canScrollPrev}
              onClick={() => api?.scrollPrev()}
              size="sm"
              variant="outline"
              aria-label="Previous page of continue watching"
            >
              <ArrowLeft className="size-3" />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              type="button"
              disabled={!canScrollNext}
              onClick={() => api?.scrollNext()}
              size="sm"
              variant="outline"
              aria-label="Next page of continue watching"
            >
              <ArrowRight className="size-3" />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>

        <CarouselContent className="-ml-3">
          {items.map((item) => (
            <CarouselItem
              key={`${item.mediaType}-${item.contentId}`}
              className="basis-[85%] pl-3 sm:basis-[70%] md:basis-[42%] lg:basis-[32%] xl:basis-[28%]"
            >
              <RecentlyWatchedCard item={item} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

export function HomeRecentlyWatched() {
  return <RecentlyWatchedRow scope="all" />;
}
