"use client";

import { RecentlyWatchedRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { CatalogHubRow } from "@/components/catalog/catalog-hub-row";
import { ContentRowHeader } from "@/components/content/content-row-header";
import {
  carouselItemClassName,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { RecentlyWatchedCard } from "@/components/home/recently-watched-card";
import { CarouselItem } from "@/components/ui/carousel";
import { useContinueWatchingActions } from "@/hooks/use-continue-watching-actions";
import { usePersonalizedHome } from "@/hooks/use-personalized-home";
import { useRecentlyWatched } from "@/hooks/use-recently-watched";
import { continueWatchingTitleKey } from "@/lib/playback/continue-watching-dismiss";
import type { RecentlyWatchedScope } from "@/lib/playback/recently-watched";
import { contentRowActionLinkClassName } from "@/lib/content-row-action-link";
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
  const catalogCardStyle = useCatalogCardStyle();
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

  const watchlistAction = isSignedIn ? (
    <Link href="/watchlist" className={contentRowActionLinkClassName}>
      <span>Watchlist</span>
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  ) : undefined;

  return (
    <CatalogHubRow
      ariaLabel="Continue watching"
      bleed={bleed}
      reveal
      header={
        <ContentRowHeader
          bleed={bleed}
          title="Continue Watching"
          action={watchlistAction}
        />
      }
    >
      {items.map((item, index) => (
        <CarouselItem
          key={`${item.mediaType}-${item.contentId}`}
          className={carouselItemClassName(catalogCardStyle)}
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
    </CatalogHubRow>
  );
}

export function HomeRecentlyWatched() {
  return <RecentlyWatchedRow bleed scope="all" />;
}
