"use client";

import { getSession } from "next-auth/react";
import { useCallback, useRef } from "react";

import {
  clampPlaybackProgress,
  getPlaybackProgress,
  resolveResumeTime,
  setPlaybackProgress,
  shouldPersistPlaybackProgress,
  type PlaybackProgressKey,
} from "@/lib/playback/progress-storage";
import { logger } from "@/lib/utils";

const SAVE_INTERVAL_MS = 5_000;
const WATCHLIST_SYNC_INTERVAL_MS = 30_000;

export function usePlaybackProgress(key: PlaybackProgressKey) {
  const savedEntryRef = useRef(getPlaybackProgress(key));
  const lastSavedAtRef = useRef(0);
  const lastWatchlistSyncRef = useRef(0);
  const watchlistSyncedRef = useRef(false);

  const resumeTime = resolveResumeTime(savedEntryRef.current);

  const syncWatchlist = useCallback(async () => {
    const session = await getSession();
    if (!session?.user?.id) {
      return;
    }

    await fetch("/api/watchlist/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId: key.contentId,
        mediaType: key.mediaType,
        ...(key.mediaType === "tv"
          ? {
              seasonNumber: key.seasonNumber,
              episodeNumber: key.episodeNumber,
            }
          : {}),
      }),
    });
  }, [key.contentId, key.episodeNumber, key.mediaType, key.seasonNumber]);

  const persist = useCallback(
    (watched: number, duration: number) => {
      if (!shouldPersistPlaybackProgress(watched, duration)) {
        return;
      }

      const clamped = clampPlaybackProgress(watched, duration);
      if (!clamped) {
        return;
      }

      const now = Date.now();
      if (now - lastSavedAtRef.current < SAVE_INTERVAL_MS) {
        return;
      }

      lastSavedAtRef.current = now;
      setPlaybackProgress(key, clamped);

      const shouldSyncWatchlist =
        key.mediaType === "tv" &&
        key.seasonNumber != null &&
        key.episodeNumber != null &&
        (now - lastWatchlistSyncRef.current >= WATCHLIST_SYNC_INTERVAL_MS ||
          !watchlistSyncedRef.current);

      if (!shouldSyncWatchlist) {
        return;
      }

      lastWatchlistSyncRef.current = now;
      watchlistSyncedRef.current = true;

      void syncWatchlist().catch((error) => {
        logger.error("Failed to sync playback progress to watchlist", error);
      });
    },
    [key, syncWatchlist],
  );

  const persistImmediate = useCallback(
    (watched: number, duration: number) => {
      lastSavedAtRef.current = 0;
      persist(watched, duration);

      if (key.mediaType === "movie") {
        void syncWatchlist().catch((error) => {
          logger.error("Failed to sync movie progress to watchlist", error);
        });
      }
    },
    [key.mediaType, persist, syncWatchlist],
  );

  return {
    resumeTime,
    persist,
    persistImmediate,
  };
}
