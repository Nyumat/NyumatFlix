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
    void 0;
  }
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
