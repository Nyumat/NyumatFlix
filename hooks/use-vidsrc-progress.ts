"use client";

import { logger } from "@/lib/utils";
import { getSession } from "next-auth/react";
import { useEffect, useRef } from "react";

/**
 * localStorage key used by the VidSrc Mirror (vidsrc.wtf) embed to persist its
 * own "Continue Watching" state. We mirror the documented key so their player
 * can restore progress across sessions.
 */
export const VIDSRC_PROGRESS_STORAGE_KEY = "vidsrcwtf-Progress";

interface VidsrcProgress {
  watched: number;
  duration: number;
}

interface VidsrcProgressEntry {
  id: string;
  type: "movie" | "tv";
  title?: string;
  poster_path?: string;
  backdrop_path?: string;
  progress?: VidsrcProgress;
  last_updated?: number;
  number_of_episodes?: number;
  number_of_seasons?: number;
  last_season_watched?: string;
  last_episode_watched?: string;
}

type VidsrcProgressMap = Record<string, VidsrcProgressEntry>;

interface VidsrcMediaMessage {
  type: "MEDIA_DATA";
  data: VidsrcProgressEntry | VidsrcProgressMap;
}

function isVidsrcOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "vidsrc.wtf" || host.endsWith(".vidsrc.wtf");
  } catch {
    return false;
  }
}

function isMediaMessage(data: unknown): data is VidsrcMediaMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "MEDIA_DATA" &&
    "data" in data
  );
}

function isSingleEntry(
  data: VidsrcProgressEntry | VidsrcProgressMap,
): data is VidsrcProgressEntry {
  const candidate = data as VidsrcProgressEntry;
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

/**
 * Picks the most recently updated entry so we can sync a single item to the
 * app's watchlist progress endpoint even when the player emits its full map.
 */
function pickLatestEntry(
  data: VidsrcProgressEntry | VidsrcProgressMap,
): VidsrcProgressEntry | null {
  if (isSingleEntry(data)) {
    return data;
  }

  let latest: VidsrcProgressEntry | null = null;
  for (const entry of Object.values(data)) {
    if (!entry || typeof entry.id !== "string") continue;
    if (!latest || (entry.last_updated ?? 0) > (latest.last_updated ?? 0)) {
      latest = entry;
    }
  }
  return latest;
}

/**
 * Listens for watch-progress messages emitted by the VidSrc Mirror embed.
 *
 * Two things happen on each `MEDIA_DATA` event:
 * 1. The payload is persisted to localStorage under the key the embed expects,
 *    powering its native "Continue Watching" UI.
 * 2. The most-recently-updated title is synced to our own
 *    `/api/watchlist/progress` endpoint (authenticated users only) so the
 *    in-app continue-watching stays in sync with what the user actually watched.
 */
export function useVidsrcProgress(): void {
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncToWatchlist = async (entry: VidsrcProgressEntry) => {
      const contentId = Number.parseInt(entry.id, 10);
      if (!Number.isFinite(contentId) || contentId <= 0) return;

      let seasonNumber: number | undefined;
      let episodeNumber: number | undefined;

      if (entry.type === "tv") {
        seasonNumber = entry.last_season_watched
          ? Number.parseInt(entry.last_season_watched, 10)
          : undefined;
        episodeNumber = entry.last_episode_watched
          ? Number.parseInt(entry.last_episode_watched, 10)
          : undefined;
        if (
          !seasonNumber ||
          !episodeNumber ||
          !Number.isFinite(seasonNumber) ||
          !Number.isFinite(episodeNumber)
        ) {
          return;
        }
      }

      const syncKey = `${contentId}-${entry.type}-${seasonNumber ?? ""}-${episodeNumber ?? ""}`;
      if (lastSyncedRef.current === syncKey) return;

      const session = await getSession();
      if (!session?.user?.id) return;

      lastSyncedRef.current = syncKey;

      await fetch("/api/watchlist/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          mediaType: entry.type,
          ...(entry.type === "tv" ? { seasonNumber, episodeNumber } : {}),
        }),
      });
    };

    const handleMessage = (event: MessageEvent) => {
      if (!isVidsrcOrigin(event.origin)) return;
      if (!isMediaMessage(event.data)) return;

      const mediaData = event.data.data;

      try {
        window.localStorage.setItem(
          VIDSRC_PROGRESS_STORAGE_KEY,
          JSON.stringify(mediaData),
        );
      } catch (error) {
        logger.error("Failed to persist VidSrc progress", error);
      }

      const latest = pickLatestEntry(mediaData);
      if (latest) {
        void syncToWatchlist(latest).catch((error) => {
          logger.error("Failed to sync VidSrc progress to watchlist", error);
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
}
