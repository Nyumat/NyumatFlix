"use client";

import { RecentlyWatchedRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { HomeWideCarouselRow } from "@/components/home/home-wide-carousel-row";
import { RecentlyWatchedCard } from "@/components/home/recently-watched-card";
import {
  useUpNextInbox,
  type UpNextInboxItem,
} from "@/hooks/use-up-next-inbox";

export function UpNextInboxRow() {
  const { items, isLoading, isSignedIn } = useUpNextInbox();

  if (!isSignedIn) {
    return null;
  }

  if (isLoading) {
    return <RecentlyWatchedRowFallback />;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <HomeWideCarouselRow<UpNextInboxItem>
      ariaLabel="Up next"
      title="Up Next"
      description="Unwatched episodes from shows you are watching"
      actionHref="/watchlist"
      actionLabel="Watchlist"
      items={items}
      getItemKey={(item) => `${item.contentId}-${item.upNextHref}`}
      renderItem={(item, index) => (
        <RecentlyWatchedCard
          item={item}
          priority={index <= 2}
          showProgress={false}
          playAriaLabel={`Play next episode of ${item.title}`}
          episodeInfo={item.episodeInfo}
        />
      )}
    />
  );
}

export function HomeUpNextInbox() {
  return <UpNextInboxRow />;
}
