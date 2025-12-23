"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCountdown } from "@/lib/utils/countdown";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";

interface EpisodeIndicatorProps {
  contentId: number;
  mediaType: "movie" | "tv";
  episodeInfo: EpisodeInfo | null;
}

export function EpisodeIndicator({
  contentId,
  mediaType,
  episodeInfo,
}: EpisodeIndicatorProps) {
  const [countdown, setCountdown] = useState<string | null>(
    episodeInfo?.countdown || null,
  );

  // Update countdown every minute if there's a next episode
  // All hooks must be called before any conditional returns
  useEffect(() => {
    // Only update if we have episode info and a next episode date
    if (!episodeInfo?.nextEpisodeDate) {
      return;
    }

    const updateCountdown = () => {
      const newCountdown = formatCountdown(episodeInfo.nextEpisodeDate!);
      setCountdown(newCountdown);
    };

    // Update immediately
    updateCountdown();

    // Update every minute
    const interval = setInterval(updateCountdown, 60 * 1000);

    return () => clearInterval(interval);
  }, [episodeInfo?.nextEpisodeDate]);

  // Only show for TV shows
  if (mediaType !== "tv" || !episodeInfo) {
    return null;
  }

  // Show new episodes count if available
  if (episodeInfo.hasNewEpisodes && episodeInfo.newEpisodeCount > 0) {
    return (
      <Badge
        variant="default"
        className="bg-primary text-primary-foreground text-xs font-medium"
      >
        {episodeInfo.newEpisodeCount === 1
          ? "1 new episode"
          : `${episodeInfo.newEpisodeCount} new episodes`}
      </Badge>
    );
  }

  // Show countdown if no new episodes but show is ongoing
  if (episodeInfo.nextEpisodeDate && countdown) {
    return (
      <Badge
        variant="outline"
        className="border-primary/50 text-primary text-xs font-medium"
      >
        {countdown} until next episode
      </Badge>
    );
  }

  return null;
}
