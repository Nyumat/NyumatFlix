"use client";

import { getSession } from "next-auth/react";

import {
  PLAYBACK_PROGRESS_STORAGE_KEY,
  LAST_TV_EPISODE_STORAGE_KEY,
  parseProgressStorageKey,
  type ListedPlaybackProgress,
} from "@/lib/playback/progress-storage";
import { setSignedInLedger } from "@/lib/playback/progress-ledger-facade";

const migrationKeyForUser = (userId: string): string =>
  `nyumatflix:playback-ledger-migrated:${userId}`;

const readLegacyLocalProgress = (): ListedPlaybackProgress[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PLAYBACK_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Record<
      string,
      { watched: number; duration: number; updatedAt: number }
    >;

    const listed: ListedPlaybackProgress[] = [];
    for (const [storageKey, entry] of Object.entries(parsed)) {
      if (
        !entry ||
        typeof entry.watched !== "number" ||
        typeof entry.duration !== "number"
      ) {
        continue;
      }

      const parsedKey = parseProgressStorageKey(storageKey);
      if (!parsedKey) {
        continue;
      }

      listed.push({
        ...parsedKey,
        watched: entry.watched,
        duration: entry.duration,
        updatedAt: entry.updatedAt ?? Date.now(),
        storageKey,
      });
    }

    return listed;
  } catch {
    return [];
  }
};

const clearLegacyLocalProgress = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PLAYBACK_PROGRESS_STORAGE_KEY);
  window.localStorage.removeItem(LAST_TV_EPISODE_STORAGE_KEY);
};

const migrateLegacyLocalProgress = async (
  userId: string,
  legacy: ListedPlaybackProgress[],
): Promise<boolean> => {
  const response = await fetch("/api/playback/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entries: legacy.map((entry) => ({
        mediaType: entry.mediaType,
        contentId: entry.contentId,
        seasonNumber: entry.seasonNumber,
        episodeNumber: entry.episodeNumber,
        watchedSeconds: entry.watched,
        durationSeconds: entry.duration,
        updatedAt: entry.updatedAt,
      })),
    }),
  });

  if (!response.ok) {
    return false;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(migrationKeyForUser(userId), "true");
    clearLegacyLocalProgress();
  }

  return true;
};

export const hydrateSignedInPlaybackLedger = async (): Promise<void> => {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return;
  }

  const response = await fetch("/api/playback/progress");
  if (!response.ok) {
    return;
  }

  const payload = (await response.json()) as {
    entries?: ListedPlaybackProgress[];
  };
  const entries = payload.entries ?? [];

  const migrationKey = migrationKeyForUser(userId);
  const hasMigrated =
    typeof window !== "undefined" &&
    window.localStorage.getItem(migrationKey) === "true";

  if (entries.length === 0 && !hasMigrated) {
    const legacy = readLegacyLocalProgress();
    if (legacy.length > 0) {
      const migrated = await migrateLegacyLocalProgress(userId, legacy);
      if (!migrated) {
        return;
      }

      const refreshed = await fetch("/api/playback/progress");
      if (refreshed.ok) {
        const refreshedPayload = (await refreshed.json()) as {
          entries?: ListedPlaybackProgress[];
        };
        setSignedInLedger(refreshedPayload.entries ?? []);
        return;
      }
    }
  }

  setSignedInLedger(entries);
};
