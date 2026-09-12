import { notifyPlaybackProgressChanged } from "@/lib/playback/progress-change-events";
import {
  listLedgerEntries,
  readGuestLastTvEpisode,
  readLedgerEntry,
  writeLedgerEntry,
} from "@/lib/playback/progress-ledger-facade";

export const PLAYBACK_PROGRESS_STORAGE_KEY = "nyumatflix.playback.progress";
export const LAST_TV_EPISODE_STORAGE_KEY = "nyumatflix.tv.last-episode";

export type PlaybackMediaType = "movie" | "tv";

export type PlaybackProgressKey = {
  mediaType: PlaybackMediaType;
  contentId: number;
  seasonNumber?: number;
  episodeNumber?: number;
  anilistId?: number | null;
};

export type PlaybackProgressEntry = {
  watched: number;
  duration: number;
  updatedAt: number;
};

export type PlaybackProgressMap = Record<string, PlaybackProgressEntry>;

export type TvEpisodeCoords = {
  seasonNumber: number;
  episodeNumber: number;
  updatedAt: number;
};

export const PLAYBACK_FINISH_BUFFER_SECONDS = 120;
export const PLAYBACK_PERSIST_MIN_SECONDS = 3;

export const progressStorageKey = (key: PlaybackProgressKey): string => {
  const parts = [
    key.mediaType,
    key.contentId,
    key.seasonNumber ?? "",
    key.episodeNumber ?? "",
  ];
  return parts.join(":");
};

const PROGRESS_STORAGE_LOCK = "nyumatflix:playback-progress";
const LAST_TV_EPISODE_LOCK = "nyumatflix:tv-last-episode";

const runWithOptionalLock = (lockName: string, task: () => void): void => {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    void navigator.locks.request(lockName, task);
    return;
  }

  task();
};

export const mergePlaybackProgressEntry = (
  current: PlaybackProgressEntry | undefined,
  incoming: Omit<PlaybackProgressEntry, "updatedAt">,
  updatedAt: number,
): PlaybackProgressEntry => {
  if (!current) {
    return { ...incoming, updatedAt };
  }

  if (updatedAt >= current.updatedAt) {
    return { ...incoming, updatedAt };
  }

  if (incoming.watched > current.watched) {
    return {
      watched: incoming.watched,
      duration: Math.max(current.duration, incoming.duration),
      updatedAt: current.updatedAt,
    };
  }

  return current;
};

export type ParsedProgressStorageKey = {
  mediaType: PlaybackMediaType;
  contentId: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

export type ListedPlaybackProgress = ParsedProgressStorageKey &
  PlaybackProgressEntry & {
    storageKey: string;
  };

export const parseProgressStorageKey = (
  key: string,
): ParsedProgressStorageKey | null => {
  const parts = key.split(":");
  if (parts.length < 2) {
    return null;
  }

  const mediaType = parts[0];
  if (mediaType !== "movie" && mediaType !== "tv") {
    return null;
  }

  const contentId = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(contentId) || contentId <= 0) {
    return null;
  }

  const seasonRaw = parts[2];
  const episodeRaw = parts[3];
  const seasonParsed =
    seasonRaw && seasonRaw.length > 0
      ? Number.parseInt(seasonRaw, 10)
      : Number.NaN;
  const episodeParsed =
    episodeRaw && episodeRaw.length > 0
      ? Number.parseInt(episodeRaw, 10)
      : Number.NaN;

  return {
    mediaType,
    contentId,
    ...(Number.isFinite(seasonParsed) && seasonParsed > 0
      ? { seasonNumber: seasonParsed }
      : {}),
    ...(Number.isFinite(episodeParsed) && episodeParsed > 0
      ? { episodeNumber: episodeParsed }
      : {}),
  };
};

export const getPlaybackProgress = (
  key: PlaybackProgressKey,
): PlaybackProgressEntry | null => readLedgerEntry(key);

export const listPlaybackProgress = (): ListedPlaybackProgress[] =>
  listLedgerEntries();

export const playbackProgressRatio = (entry: {
  watched: number;
  duration: number;
}): number | null => {
  if (
    !Number.isFinite(entry.watched) ||
    !Number.isFinite(entry.duration) ||
    entry.duration <= 0
  ) {
    return null;
  }

  return Math.max(0, Math.min(1, entry.watched / entry.duration));
};

export const rememberLastTvEpisode = (
  contentId: number,
  seasonNumber: number,
  episodeNumber: number,
  updatedAt: number = Date.now(),
): void => {
  if (
    !Number.isInteger(contentId) ||
    contentId <= 0 ||
    !Number.isInteger(seasonNumber) ||
    seasonNumber <= 0 ||
    !Number.isInteger(episodeNumber) ||
    episodeNumber <= 0
  ) {
    return;
  }

  runWithOptionalLock(LAST_TV_EPISODE_LOCK, () => {
    writeLedgerEntry(
      {
        mediaType: "tv",
        contentId,
        seasonNumber,
        episodeNumber,
      },
      { watched: 0, duration: 0 },
    );
  });
};

export const getRememberedLastTvEpisode = (
  contentId: number,
): TvEpisodeCoords | null => readGuestLastTvEpisode(contentId);

export const getLatestTvPlaybackCoords = (
  contentId: number,
): TvEpisodeCoords | null => {
  const latest = listPlaybackProgress().find(
    (entry) =>
      entry.mediaType === "tv" &&
      entry.contentId === contentId &&
      entry.seasonNumber != null &&
      entry.episodeNumber != null,
  );

  if (
    latest?.seasonNumber == null ||
    latest.episodeNumber == null ||
    latest.seasonNumber <= 0 ||
    latest.episodeNumber <= 0
  ) {
    return null;
  }

  return {
    seasonNumber: latest.seasonNumber,
    episodeNumber: latest.episodeNumber,
    updatedAt: latest.updatedAt,
  };
};

export const setPlaybackProgress = (
  key: PlaybackProgressKey,
  entry: Omit<PlaybackProgressEntry, "updatedAt">,
): void => {
  runWithOptionalLock(PROGRESS_STORAGE_LOCK, () => {
    writeLedgerEntry(key, entry);
    notifyPlaybackProgressChanged();
  });
};

export const resolveResumeTime = (
  entry: PlaybackProgressEntry | null,
): number => {
  if (!entry || entry.duration <= 0 || entry.watched <= 0) {
    return 0;
  }

  const watched = Math.min(entry.watched, entry.duration);
  const remaining = entry.duration - watched;

  if (remaining <= PLAYBACK_FINISH_BUFFER_SECONDS) {
    return 0;
  }

  return watched;
};

export const clampPlaybackProgress = (
  watched: number,
  duration: number,
): { watched: number; duration: number } | null => {
  if (
    !Number.isFinite(watched) ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null;
  }

  return {
    watched: Math.max(0, Math.min(watched, duration)),
    duration,
  };
};

export const shouldPersistPlaybackProgress = (
  watched: number,
  duration: number,
): boolean => {
  if (
    !Number.isFinite(watched) ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return false;
  }

  if (watched < PLAYBACK_PERSIST_MIN_SECONDS) {
    return false;
  }

  if (watched >= duration - 1) {
    return false;
  }

  return true;
};
