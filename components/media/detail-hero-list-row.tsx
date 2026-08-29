"use client";

import { DetailWatchlistStatusToggle } from "@/components/media/detail-watchlist-status-toggle";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import type { ContinueWatchingCompleteMedia } from "@/lib/playback/continue-watching-complete";
import { useTvDetailCatalog } from "@/hooks/use-tv-detail-catalog";
import { useMalSyncStatus } from "@/hooks/use-mal-sync-status";
import { useWatchlistItem } from "@/hooks/useWatchlistItem";
import { cn } from "@/lib/utils";

type DetailHeroListRowProps = {
  contentId: number;
  mediaType: "movie" | "tv";
  anilistId?: number | null;
  watchlistItem?: WatchlistItem | null;
  completeMedia?: ContinueWatchingCompleteMedia | null;
  seasonNumber?: number | null;
  className?: string;
};

export function DetailHeroListRow({
  contentId,
  mediaType,
  anilistId,
  watchlistItem: watchlistItemProp,
  className,
}: DetailHeroListRowProps) {
  const catalog = useTvDetailCatalog();
  const isAnimeCatalog = catalog === "anime";
  const hasAnilistId = typeof anilistId === "number" && anilistId > 0;

  const { watchlistItem: watchlistItemFetched, refetch } = useWatchlistItem(
    contentId,
    mediaType,
  );

  const watchlistItem = watchlistItemProp ?? watchlistItemFetched;

  const malStatusQuery = useMalSyncStatus();
  const malConnected = malStatusQuery.data?.connected === true;
  const showMalControls =
    malConnected && mediaType === "tv" && (hasAnilistId || isAnimeCatalog);
  const showNyumatToggle =
    Boolean(watchlistItem) && !showMalControls && mediaType === "tv";

  if (!showNyumatToggle) {
    return null;
  }

  const handleUpdated = () => {
    void refetch();
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {watchlistItem ? (
        <DetailWatchlistStatusToggle
          watchlistItem={watchlistItem}
          onUpdated={handleUpdated}
        />
      ) : null}
    </div>
  );
}
