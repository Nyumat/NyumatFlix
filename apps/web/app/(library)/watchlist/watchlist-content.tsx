import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import { fetchWatchlistMediaItems } from "@/lib/server/watchlist-media";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { WatchlistClient } from "./watchlist-client";

interface WatchlistContentProps {
  watchlistItems: WatchlistItem[];
}

export async function WatchlistContent({
  watchlistItems,
}: WatchlistContentProps) {
  const allItems = await fetchWatchlistMediaItems(watchlistItems);

  return (
    <ContentReveal>
      <WatchlistClient allItems={allItems} watchlistItems={watchlistItems} />
    </ContentReveal>
  );
}
