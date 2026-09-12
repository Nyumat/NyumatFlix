import {
  clampSubtitleAppearance,
  DEFAULT_SUBTITLE_APPEARANCE,
  subtitleAppearancesEqual,
  type SubtitleAppearance,
} from "@/lib/playback/subtitle-appearance";
import { patchUserSettings } from "@/lib/user/patch-user-settings";

export const SUBTITLE_APPEARANCE_STORAGE_KEY =
  "nyumatflix.playback.subtitle-appearance";

export const SUBTITLE_APPEARANCE_CHANGE_EVENT =
  "nyumatflix:subtitle-appearance-change";

let cachedSnapshot: SubtitleAppearance | null = null;

const readSnapshotFromStorage = (): SubtitleAppearance =>
  DEFAULT_SUBTITLE_APPEARANCE;

const ensureCachedSnapshot = (): SubtitleAppearance => {
  if (!cachedSnapshot) {
    cachedSnapshot = readSnapshotFromStorage();
  }

  return cachedSnapshot;
};

const setCachedSnapshot = (next: SubtitleAppearance): SubtitleAppearance => {
  cachedSnapshot = next;
  return cachedSnapshot;
};

export const resetSubtitleAppearanceSnapshotForTests = (): void => {
  cachedSnapshot = null;
};

export const getSubtitleAppearance = (): SubtitleAppearance => {
  if (typeof window === "undefined") {
    return DEFAULT_SUBTITLE_APPEARANCE;
  }

  return ensureCachedSnapshot();
};

export const setSubtitleAppearance = (
  appearance: SubtitleAppearance,
): SubtitleAppearance => {
  const clamped = clampSubtitleAppearance(appearance);
  setCachedSnapshot(clamped);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SUBTITLE_APPEARANCE_CHANGE_EVENT, { detail: clamped }),
    );
    void patchUserSettings({ subtitleAppearance: clamped });
  }

  return clamped;
};

export const resetSubtitleAppearance = (): SubtitleAppearance => {
  setCachedSnapshot(DEFAULT_SUBTITLE_APPEARANCE);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SUBTITLE_APPEARANCE_CHANGE_EVENT, {
        detail: DEFAULT_SUBTITLE_APPEARANCE,
      }),
    );
    void patchUserSettings({ subtitleAppearance: DEFAULT_SUBTITLE_APPEARANCE });
  }

  return DEFAULT_SUBTITLE_APPEARANCE;
};

export const subscribeSubtitleAppearance = (
  listener: () => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(SUBTITLE_APPEARANCE_CHANGE_EVENT, listener);

  return () => {
    window.removeEventListener(SUBTITLE_APPEARANCE_CHANGE_EVENT, listener);
  };
};
