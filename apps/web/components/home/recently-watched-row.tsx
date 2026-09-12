"use client";

import { RecentlyWatchedRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { homeWideCarouselItemClassName } from "@/components/home/home-wide-carousel-row";
import { RecentlyWatchedCard } from "@/components/home/recently-watched-card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useContinueWatchingActions } from "@/hooks/use-continue-watching-actions";
import { usePersonalizedHome } from "@/hooks/use-personalized-home";
import { useRecentlyWatched } from "@/hooks/use-recently-watched";
import { continueWatchingTitleKey } from "@/lib/playback/continue-watching-dismiss";
import type { RecentlyWatchedScope } from "@/lib/playback/recently-watched";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type RecentlyWatchedRowProps = {
  scope?: RecentlyWatchedScope;
  bleed?: boolean;
};

export function RecentlyWatchedRow({
  scope = "all",
  bleed = false,
}: RecentlyWatchedRowProps) {
  const { status: sessionStatus } = useSession();
  const personalized = usePersonalizedHome({ enabled: scope === "all" });
  const continueWatchingActions = useContinueWatchingActions();
  const usePersonalizedSource =
    scope === "all" && sessionStatus !== "loading" && personalized.isSignedIn;
  const scopedRecentlyWatched = useRecentlyWatched(scope, {
    enabled: !usePersonalizedSource,
  });

  const { items, isLoading, isSignedIn, markComplete, pendingCompleteKey } =
    usePersonalizedSource
      ? {
          items: personalized.recentlyWatched,
          isLoading: personalized.isLoading,
          isSignedIn: personalized.isSignedIn,
          markComplete: continueWatchingActions.markComplete,
          pendingCompleteKey: continueWatchingActions.pendingCompleteKey,
        }
      : {
          ...scopedRecentlyWatched,
          isLoading:
            scope === "all" && sessionStatus === "loading"
              ? true
              : scopedRecentlyWatched.isLoading,
        };

  if (isLoading) {
    return <RecentlyWatchedRowFallback bleed={bleed} />;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Continue watching"
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both",
        bleed && "index-bleed",
      )}
    >
      <Carousel
        className="group/row"
        opts={{
          align: "start",
          slidesToScroll: "auto",
          dragFree: true,
          containScroll: "trimSnaps",
        }}
      >
        <div
          className={cn(
            "mb-4 flex items-baseline justify-between gap-3",
            bleed ? "index-rail-padding" : "px-1",
          )}
        >
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                "truncate font-semibold tracking-tight",
                bleed ? "text-xl md:text-2xl" : "text-lg md:text-xl",
              )}
            >
              Continue Watching
            </h2>
          </div>

          {isSignedIn ? (
            <Link
              href="/watchlist"
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              prefetch={false}
            >
              <span>Watchlist</span>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>

        <CarouselContent
          className="-ml-3"
          viewportClassName={bleed ? "index-rail-padding" : undefined}
        >
          {items.map((item, index) => (
            <CarouselItem
              key={`${item.mediaType}-${item.contentId}`}
              className={homeWideCarouselItemClassName}
            >
              <RecentlyWatchedCard
                item={item}
                priority={index <= 2}
                isMarkCompletePending={
                  pendingCompleteKey ===
                  continueWatchingTitleKey(item.mediaType, item.contentId)
                }
                onMarkComplete={() => markComplete(item)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious
          variant="ghost"
          className={cn(
            "hidden top-1/2 z-20 h-12 w-12 -translate-y-1/2 text-white opacity-0 drop-shadow-lg transition-all duration-300 hover:scale-110 hover:bg-transparent hover:text-white group-hover/row:opacity-100 group-focus-within/row:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex",
            bleed ? "left-2" : "left-0",
          )}
          aria-label="Scroll left"
        />
        <CarouselNext
          variant="ghost"
          className={cn(
            "hidden top-1/2 z-20 h-12 w-12 -translate-y-1/2 text-white opacity-0 drop-shadow-lg transition-all duration-300 hover:scale-110 hover:bg-transparent hover:text-white group-hover/row:opacity-100 group-focus-within/row:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex",
            bleed ? "right-2" : "right-0",
          )}
          aria-label="Scroll right"
        />
      </Carousel>
    </section>
  );
}

export function HomeRecentlyWatched() {
  return <RecentlyWatchedRow bleed scope="all" />;
}
