"use client";

import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { usePlaybackProgressRevision } from "@/hooks/use-playback-progress-revision";
import { movieWatchButtonLabel } from "@/lib/playback/movie-watch-label";
import { useMemo } from "react";

export function useMovieWatchButtonLabel(
  contentId: number,
  mediaType?: "tv" | "movie",
): "Play" | "Resume" {
  const isHydrated = useIsHydrated();
  const progressRevision = usePlaybackProgressRevision();

  return useMemo(() => {
    if (!isHydrated || mediaType !== "movie") {
      return "Play";
    }

    return movieWatchButtonLabel(contentId);
  }, [contentId, isHydrated, mediaType, progressRevision]);
}
