"use client";

import { CheckCircle2 } from "lucide-react";
import { WatchlistItem } from "@/app/watchlist/actions";
import { cn } from "@/lib/utils";

interface EpisodeProgressIndicatorProps {
  seasonNumber: number;
  episodeNumber: number;
  watchlistItem: WatchlistItem | null;
  className?: string;
}

export function EpisodeProgressIndicator({
  seasonNumber,
  episodeNumber,
  watchlistItem,
  className,
}: EpisodeProgressIndicatorProps) {
  const isLastWatched =
    watchlistItem &&
    watchlistItem.lastWatchedSeason === seasonNumber &&
    watchlistItem.lastWatchedEpisode === episodeNumber;

  if (!isLastWatched) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-primary font-medium",
        className,
      )}
      title="Last watched episode"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>Last watched</span>
    </div>
  );
}
