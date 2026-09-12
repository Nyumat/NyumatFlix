import type {
  ListedPlaybackProgress,
  PlaybackProgressEntry,
  PlaybackProgressKey,
  PlaybackProgressMap,
  TvEpisodeCoords,
} from "@/lib/playback/progress-storage";
import {
  mergePlaybackProgressEntry,
  parseProgressStorageKey,
  progressStorageKey,
} from "@/lib/playback/progress-storage";

type GuestLedgerState = {
  progress: PlaybackProgressMap;
  lastTvEpisodes: Record<string, TvEpisodeCoords>;
};

const guestLedger: GuestLedgerState = {
  progress: {},
  lastTvEpisodes: {},
};

let signedInLedger: PlaybackProgressMap | null = null;
let signedInLedgerLoaded = false;

export const resetGuestLedger = (): void => {
  guestLedger.progress = {};
  guestLedger.lastTvEpisodes = {};
};

export const setSignedInLedger = (entries: ListedPlaybackProgress[]): void => {
  const map: PlaybackProgressMap = {};
  for (const entry of entries) {
    map[entry.storageKey] = {
      watched: entry.watched,
      duration: entry.duration,
      updatedAt: entry.updatedAt,
    };
  }
  signedInLedger = map;
  signedInLedgerLoaded = true;
};

export const clearSignedInLedger = (): void => {
  signedInLedger = null;
  signedInLedgerLoaded = false;
};

export const isSignedInLedgerLoaded = (): boolean => signedInLedgerLoaded;

const isSignedInLedgerActive = (): boolean =>
  signedInLedgerLoaded && signedInLedger != null;

const activeMap = (): PlaybackProgressMap => {
  if (signedInLedgerLoaded && signedInLedger) {
    return signedInLedger;
  }
  return guestLedger.progress;
};

export const readLedgerMap = (): PlaybackProgressMap => ({ ...activeMap() });

export const readLedgerEntry = (
  key: PlaybackProgressKey,
): PlaybackProgressEntry | null => {
  const entry = activeMap()[progressStorageKey(key)];
  if (!entry || typeof entry.watched !== "number") {
    return null;
  }
  return entry;
};

export const writeLedgerEntry = (
  key: PlaybackProgressKey,
  entry: Omit<PlaybackProgressEntry, "updatedAt">,
): PlaybackProgressEntry => {
  const storageKey = progressStorageKey(key);
  const updatedAt = Date.now();
  const map = activeMap();
  const merged = mergePlaybackProgressEntry(map[storageKey], entry, updatedAt);
  map[storageKey] = merged;

  if (
    !isSignedInLedgerActive() &&
    key.mediaType === "tv" &&
    key.seasonNumber != null &&
    key.episodeNumber != null
  ) {
    const tvKey = String(key.contentId);
    const next: TvEpisodeCoords = {
      seasonNumber: key.seasonNumber,
      episodeNumber: key.episodeNumber,
      updatedAt,
    };
    const current = guestLedger.lastTvEpisodes[tvKey];
    guestLedger.lastTvEpisodes[tvKey] =
      !current || next.updatedAt >= current.updatedAt ? next : current;
  }

  return merged;
};

export const readGuestLastTvEpisode = (
  contentId: number,
): TvEpisodeCoords | null => {
  const entry = guestLedger.lastTvEpisodes[String(contentId)];
  if (
    !entry ||
    !Number.isInteger(entry.seasonNumber) ||
    entry.seasonNumber <= 0 ||
    !Number.isInteger(entry.episodeNumber) ||
    entry.episodeNumber <= 0
  ) {
    return null;
  }
  return entry;
};

export const listLedgerEntries = (): ListedPlaybackProgress[] => {
  const map = activeMap();
  const listed: ListedPlaybackProgress[] = [];

  for (const [storageKey, entry] of Object.entries(map)) {
    if (
      !entry ||
      typeof entry.watched !== "number" ||
      typeof entry.duration !== "number" ||
      typeof entry.updatedAt !== "number"
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
      updatedAt: entry.updatedAt,
      storageKey,
    });
  }

  return listed.sort((a, b) => b.updatedAt - a.updatedAt);
};
