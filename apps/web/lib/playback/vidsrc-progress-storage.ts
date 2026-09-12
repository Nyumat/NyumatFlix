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

export const persistVidsrcProgressPayload = (
  _data: VidsrcProgressEntry | VidsrcProgressMap,
): void => {
  // vidsrc embed progress is no longer written to localStorage; resume is
  // owned by the unified playback ledger (in-memory for guests, server for
  // signed-in users). legacy reads remain for one-time migration only.
};
