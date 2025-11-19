"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { getWatchlistItem } from "@/app/watchlist/actions";
import { cn } from "@/lib/utils";

interface EpisodeProgressIndicatorProps {
  contentId: number;
  seasonNumber: number;
  episodeNumber: number;
  className?: string;
}

export function EpisodeProgressIndicator({
  contentId,
  seasonNumber,
  episodeNumber,
  className,
}: EpisodeProgressIndicatorProps) {
  const [isLastWatched, setIsLastWatched] = useState(false);

  useEffect(() => {
    const checkProgress = async () => {
      try {
        const item = await getWatchlistItem(contentId, "tv");
        if (
          item &&
          item.lastWatchedSeason === seasonNumber &&
          item.lastWatchedEpisode === episodeNumber
        ) {
          setIsLastWatched(true);
        } else {
          setIsLastWatched(false);
        }
      } catch (error) {
        console.error("Error checking episode progress:", error);
      }
    };

    checkProgress();
  }, [contentId, seasonNumber, episodeNumber]);

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
