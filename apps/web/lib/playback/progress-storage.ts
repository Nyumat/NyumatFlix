import { notifyPlaybackProgressChanged } from "@/lib/playback/progress-change-events";

export const PLAYBACK_PROGRESS_STORAGE_KEY = "nyumatflix.playback.progress";
export const LAST_TV_EPISODE_STORAGE_KEY = "nyumatflix.tv.last-episode";

export type PlaybackMediaType = "movie" | "tv";

export type PlaybackProgressKey = {
  mediaType: PlaybackMediaType;
  contentId: number;
  seasonNumber?: number;
  episodeNumber?: number;
  /**
   * AniList id for the show, when known. `contentId` is sometimes an AniList
   * id rather than a TMDB id (e.g. on `/anime/[id]` pages), so this is kept
   * separate to let MAL scrobbling resolve reliably regardless of which id
   * `contentId` actually is. Not part of the local storage key.
   */
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

/** Within this window of the end, treat saved progress as finished (resume from start). */
export const PLAYBACK_FINISH_BUFFER_SECONDS = 120;

/** Ignore persisted positions below this — avoids saving HLS startup glitches. */
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

const readMap = (): PlaybackProgressMap => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PLAYBACK_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PlaybackProgressMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = (map: PlaybackProgressMap): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PLAYBACK_PROGRESS_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    void 0;
  }
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

const mergeLastTvEpisode = (
  current: TvEpisodeCoords | undefined,
  next: TvEpisodeCoords,
): TvEpisodeCoords => {
  if (!current) {
    return next;
  }

  if (next.updatedAt >= current.updatedAt) {
    return next;
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
): PlaybackProgressEntry | null => {
  const entry = readMap()[progressStorageKey(key)];
  if (!entry || typeof entry.watched !== "number") {
    return null;
  }

  return entry;
};

/** All saved playback positions, newest first. */
export const listPlaybackProgress = (): ListedPlaybackProgress[] => {
  const map = readMap();
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

    const parsed = parseProgressStorageKey(storageKey);
    if (!parsed) {
      continue;
    }

    listed.push({
      ...parsed,
      watched: entry.watched,
      duration: entry.duration,
      updatedAt: entry.updatedAt,
      storageKey,
    });
  }

  return listed.sort((a, b) => b.updatedAt - a.updatedAt);
};

/** Fraction watched in [0, 1], or null when duration is unusable. */
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

type LastTvEpisodeMap = Record<string, TvEpisodeCoords>;

const lastTvEpisodeKey = (contentId: number): string => String(contentId);

const readLastTvEpisodeMap = (): LastTvEpisodeMap => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(LAST_TV_EPISODE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as LastTvEpisodeMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLastTvEpisodeMap = (map: LastTvEpisodeMap): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LAST_TV_EPISODE_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    void 0;
  }
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
    writeLastTvEpisodeCoords(contentId, seasonNumber, episodeNumber, updatedAt);
  });
};

const writeLastTvEpisodeCoords = (
  contentId: number,
  seasonNumber: number,
  episodeNumber: number,
  updatedAt: number,
): void => {
  const map = readLastTvEpisodeMap();
  const key = lastTvEpisodeKey(contentId);
  const next: TvEpisodeCoords = {
    seasonNumber,
    episodeNumber,
    updatedAt,
  };
  map[key] = mergeLastTvEpisode(map[key], next);
  writeLastTvEpisodeMap(map);
};

export const getRememberedLastTvEpisode = (
  contentId: number,
): TvEpisodeCoords | null => {
  const entry = readLastTvEpisodeMap()[lastTvEpisodeKey(contentId)];
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
  const apply = () => {
    const storageKey = progressStorageKey(key);
    const updatedAt = Date.now();
    const map = readMap();
    map[storageKey] = mergePlaybackProgressEntry(
      map[storageKey],
      entry,
      updatedAt,
    );
    writeMap(map);
    notifyPlaybackProgressChanged();

    if (
      key.mediaType === "tv" &&
      key.seasonNumber != null &&
      key.episodeNumber != null
    ) {
      writeLastTvEpisodeCoords(
        key.contentId,
        key.seasonNumber,
        key.episodeNumber,
        updatedAt,
      );
    }
  };

  runWithOptionalLock(PROGRESS_STORAGE_LOCK, apply);
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

/** Clamp watched time before persisting so out-of-range values cannot be stored. */
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

/** Skip bogus startup/end positions some HLS sources report before real playback. */
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
