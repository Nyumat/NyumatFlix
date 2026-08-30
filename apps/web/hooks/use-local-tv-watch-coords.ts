"use client";

import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { usePlaybackProgressRevision } from "@/hooks/use-playback-progress-revision";
import {
  resolveLocalTvWatchCoords,
  type LocalTvWatchCoords,
} from "@/lib/tv-watch-target";
import { useMemo } from "react";

export function useLocalTvWatchCoords(
  contentId: number,
): LocalTvWatchCoords | null {
  const isHydrated = useIsHydrated();
  const progressRevision = usePlaybackProgressRevision();

  return useMemo(() => {
    if (!isHydrated) {
      return null;
    }

    return resolveLocalTvWatchCoords(contentId);
  }, [contentId, isHydrated, progressRevision]);
}
