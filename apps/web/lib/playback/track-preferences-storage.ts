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

const sessionTrackPreferences: TrackPreferencesMap = {};

export const resetTrackPreferencesForTests = (): void => {
  for (const key of Object.keys(sessionTrackPreferences)) {
    delete sessionTrackPreferences[key];
  }
};

export const trackPreferenceStorageKey = (key: PlaybackProgressKey): string =>
  `${key.mediaType}:${key.contentId}`;

const readMap = (): TrackPreferencesMap => sessionTrackPreferences;

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
  return next;
};
