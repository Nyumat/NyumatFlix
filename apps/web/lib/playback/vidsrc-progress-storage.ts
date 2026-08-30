import { notifyPlaybackProgressChanged } from "@/lib/playback/progress-change-events";

export const VIDSRC_PROGRESS_STORAGE_KEY = "vidsrcwtf-Progress";

export type VidsrcProgressEntry = {
  id: string;
  type: "movie" | "tv";
  title?: string;
  poster_path?: string;
  backdrop_path?: string;
  progress?: { watched: number; duration: number };
  last_updated?: number;
  number_of_episodes?: number;
  number_of_seasons?: number;
  last_season_watched?: string;
  last_episode_watched?: string;
};

export type VidsrcProgressMap = Record<string, VidsrcProgressEntry>;

const isValidEntry = (entry: unknown): entry is VidsrcProgressEntry =>
  Boolean(entry) &&
  typeof entry === "object" &&
  typeof (entry as VidsrcProgressEntry).id === "string" &&
  ((entry as VidsrcProgressEntry).type === "movie" ||
    (entry as VidsrcProgressEntry).type === "tv");

export const isSingleVidsrcProgressEntry = (
  data: VidsrcProgressEntry | VidsrcProgressMap,
): data is VidsrcProgressEntry => {
  const candidate = data as VidsrcProgressEntry;
  return typeof candidate.id === "string" && typeof candidate.type === "string";
};

const entryStorageKey = (entry: VidsrcProgressEntry): string => entry.id;

const readRawVidsrcProgressPayload = ():
  | VidsrcProgressEntry
  | VidsrcProgressMap
  | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(VIDSRC_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as
      | VidsrcProgressEntry
      | Record<string, VidsrcProgressEntry>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (isSingleVidsrcProgressEntry(parsed)) {
      return parsed;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const readVidsrcProgressMap = (): VidsrcProgressMap => {
  const payload = readRawVidsrcProgressPayload();
  if (!payload) {
    return {};
  }

  if (isSingleVidsrcProgressEntry(payload)) {
    return { [entryStorageKey(payload)]: payload };
  }

  const map: VidsrcProgressMap = {};
  for (const entry of Object.values(payload)) {
    if (!isValidEntry(entry)) {
      continue;
    }
    map[entryStorageKey(entry)] = entry;
  }
  return map;
};

export const readVidsrcProgressEntries = (): VidsrcProgressEntry[] =>
  Object.values(readVidsrcProgressMap()).filter(isValidEntry);

const shouldReplaceEntry = (
  current: VidsrcProgressEntry | undefined,
  next: VidsrcProgressEntry,
): boolean => {
  if (!current) {
    return true;
  }
  return (next.last_updated ?? 0) >= (current.last_updated ?? 0);
};

const mergeSingleEntry = (
  existing: VidsrcProgressMap,
  entry: VidsrcProgressEntry,
): VidsrcProgressMap => {
  const key = entryStorageKey(entry);
  const current = existing[key];
  if (!shouldReplaceEntry(current, entry)) {
    return existing;
  }
  return { ...existing, [key]: entry };
};

const normalizeIncomingMap = (data: VidsrcProgressMap): VidsrcProgressMap => {
  const map: VidsrcProgressMap = {};
  for (const entry of Object.values(data)) {
    if (!isValidEntry(entry)) {
      continue;
    }
    const key = entryStorageKey(entry);
    const current = map[key];
    if (shouldReplaceEntry(current, entry)) {
      map[key] = entry;
    }
  }
  return map;
};

export const persistVidsrcProgressPayload = (
  data: VidsrcProgressEntry | VidsrcProgressMap,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (isSingleVidsrcProgressEntry(data)) {
    const merged = mergeSingleEntry(readVidsrcProgressMap(), data);
    window.localStorage.setItem(
      VIDSRC_PROGRESS_STORAGE_KEY,
      JSON.stringify(merged),
    );
    notifyPlaybackProgressChanged();
    return;
  }

  window.localStorage.setItem(
    VIDSRC_PROGRESS_STORAGE_KEY,
    JSON.stringify(normalizeIncomingMap(data)),
  );
  notifyPlaybackProgressChanged();
};
