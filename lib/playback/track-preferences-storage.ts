import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";

export const TRACK_PREFERENCES_STORAGE_KEY =
  "nyumatflix.playback.track-preferences";

export type SubtitleTrackPreference = string | "off";

export type TrackPreferences = {
  subtitleLang: SubtitleTrackPreference | null;
  audioLang: string | null;
  updatedAt: number;
};

export type TrackPreferencesMap = Record<string, TrackPreferences>;

export const trackPreferenceStorageKey = (key: PlaybackProgressKey): string =>
  `${key.mediaType}:${key.contentId}`;

const readMap = (): TrackPreferencesMap => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(TRACK_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as TrackPreferencesMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = (map: TrackPreferencesMap): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      TRACK_PREFERENCES_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    // Ignore quota errors.
  }
};

export const getTrackPreferences = (
  scopeKey: string,
): TrackPreferences | null => {
  const entry = readMap()[scopeKey];
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return entry;
};

export const setTrackPreferences = (
  scopeKey: string,
  preferences: Omit<TrackPreferences, "updatedAt">,
): void => {
  const map = readMap();
  map[scopeKey] = {
    ...preferences,
    updatedAt: Date.now(),
  };
  writeMap(map);
};

export const updateTrackPreferences = (
  scopeKey: string,
  patch: Partial<Omit<TrackPreferences, "updatedAt">>,
): TrackPreferences => {
  const current = getTrackPreferences(scopeKey);
  const next: TrackPreferences = {
    subtitleLang: patch.subtitleLang ?? current?.subtitleLang ?? null,
    audioLang: patch.audioLang ?? current?.audioLang ?? null,
    updatedAt: Date.now(),
  };

  const map = readMap();
  map[scopeKey] = next;
  writeMap(map);
  return next;
};
