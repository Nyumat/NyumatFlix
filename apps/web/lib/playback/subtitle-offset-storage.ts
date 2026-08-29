import {
  progressStorageKey,
  type PlaybackProgressKey,
} from "@/lib/playback/progress-storage";
import { clampSubtitleOffset } from "@/lib/playback/subtitle-offset";

export const SUBTITLE_OFFSET_STORAGE_KEY =
  "nyumatflix.playback.subtitle-offset";

export type SubtitleOffsetMap = Record<string, Record<string, number>>;

const readMap = (): SubtitleOffsetMap => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(SUBTITLE_OFFSET_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as SubtitleOffsetMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = (map: SubtitleOffsetMap): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SUBTITLE_OFFSET_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    void 0;
  }
};

export const subtitleOffsetScopeKey = (key: PlaybackProgressKey): string =>
  progressStorageKey(key);

export const hasSubtitleOffset = (
  scopeKey: string,
  trackKey: string,
): boolean => {
  const value = readMap()[scopeKey]?.[trackKey];
  return typeof value === "number";
};

export const getSubtitleOffset = (
  scopeKey: string,
  trackKey: string,
): number => {
  const value = readMap()[scopeKey]?.[trackKey];
  return typeof value === "number" ? clampSubtitleOffset(value) : 0;
};

export const setSubtitleOffset = (
  scopeKey: string,
  trackKey: string,
  seconds: number,
): number => {
  const clamped = clampSubtitleOffset(seconds);
  const map = readMap();
  const current = map[scopeKey] ?? {};

  if (clamped === 0) {
    const { [trackKey]: _removed, ...rest } = current;
    if (Object.keys(rest).length === 0) {
      const { [scopeKey]: _scope, ...remaining } = map;
      writeMap(remaining);
      return clamped;
    }
    map[scopeKey] = rest;
    writeMap(map);
    return clamped;
  }

  map[scopeKey] = {
    ...current,
    [trackKey]: clamped,
  };
  writeMap(map);
  return clamped;
};
