export const PLAYBACK_PROGRESS_STORAGE_KEY = "nyumatflix.playback.progress";

export type PlaybackMediaType = "movie" | "tv";

export type PlaybackProgressKey = {
  mediaType: PlaybackMediaType;
  contentId: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

export type PlaybackProgressEntry = {
  watched: number;
  duration: number;
  updatedAt: number;
};

export type PlaybackProgressMap = Record<string, PlaybackProgressEntry>;

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
    // Ignore quota errors.
  }
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

export const setPlaybackProgress = (
  key: PlaybackProgressKey,
  entry: Omit<PlaybackProgressEntry, "updatedAt">,
): void => {
  const map = readMap();
  map[progressStorageKey(key)] = {
    ...entry,
    updatedAt: Date.now(),
  };
  writeMap(map);
};

/** Return saved position, clamped to a valid in-range seek target. */
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
