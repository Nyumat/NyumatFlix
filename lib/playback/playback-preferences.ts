import {
  parseQualityLabel,
  pickDefaultScrapeQualityIndex,
  type ScrapeQualityPlayOption,
} from "@/lib/scrape/player-sources";
import type { ScrapeQuality, ScrapeSubtitle } from "@/lib/scrape/types";

export type PlaybackAudioPreference = "sub" | "dub";
export type PlaybackQualityPreference = "best" | "save-data";

export type PlaybackPreferences = {
  playbackAudio: PlaybackAudioPreference;
  playbackQuality: PlaybackQualityPreference;
  playbackEnglishSubtitles: boolean;
};

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  playbackAudio: "sub",
  playbackQuality: "best",
  playbackEnglishSubtitles: true,
};

const ADAPTIVE_QUALITY_NEUTRAL_HEIGHT = 720;

export type ScorableAnimeScrapePayload = {
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
  preferredAudioLang?: string;
};

const qualityHeightsFromPayload = (
  qualities: ScrapeQuality[] | undefined,
): number[] => {
  const heights: number[] = [];

  for (const quality of qualities ?? []) {
    const parsed = parseQualityLabel(quality.label);
    if (parsed?.height) {
      heights.push(parsed.height);
      continue;
    }

    const urlMatch = quality.url.match(/\/(\d{3,4})p\//i);
    if (urlMatch?.[1]) {
      const height = Number.parseInt(urlMatch[1], 10);
      if (Number.isFinite(height) && height > 0) {
        heights.push(height);
      }
    }
  }

  return heights;
};

export const hasEnglishSubtitles = (
  subtitles: ScrapeSubtitle[] | undefined,
): boolean =>
  (subtitles ?? []).some((track) => /^(en|english)/i.test(track.lang.trim()));

export const matchesAudioPreference = (
  preferredAudioLang: string | undefined,
  audio: PlaybackAudioPreference,
): boolean => {
  const normalized = (preferredAudioLang ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (audio === "dub") {
    return (
      normalized === "eng" || normalized === "en" || normalized === "english"
    );
  }

  return (
    normalized === "jpn" ||
    normalized === "ja" ||
    normalized === "jp" ||
    normalized === "japanese"
  );
};

export const scoreAnimeScrapePayload = (
  payload: ScorableAnimeScrapePayload,
  preferences: PlaybackPreferences,
): number => {
  let score = 0;
  const heights = qualityHeightsFromPayload(payload.qualities);
  const maxHeight =
    heights.length > 0 ? Math.max(...heights) : ADAPTIVE_QUALITY_NEUTRAL_HEIGHT;
  const minHeight =
    heights.length > 0 ? Math.min(...heights) : ADAPTIVE_QUALITY_NEUTRAL_HEIGHT;

  if (
    matchesAudioPreference(
      payload.preferredAudioLang,
      preferences.playbackAudio,
    )
  ) {
    score += 1_000;
  }

  if (preferences.playbackQuality === "best") {
    score += maxHeight;
    score += heights.length * 10;
  } else {
    score += Math.max(0, 900 - maxHeight);
    score += Math.max(0, 600 - minHeight);
    score -= heights.length * 5;
  }

  if (preferences.playbackEnglishSubtitles) {
    score += hasEnglishSubtitles(payload.subtitles) ? 80 : -40;
  }

  return score;
};

export const pickScrapeQualityIndexForPreference = (
  options: readonly Pick<ScrapeQualityPlayOption, "label">[],
  quality: PlaybackQualityPreference,
): number => {
  if (options.length <= 1) {
    return 0;
  }

  if (quality === "best") {
    return pickDefaultScrapeQualityIndex(options);
  }

  let bestIndex = 0;
  let lowestHeight = Number.POSITIVE_INFINITY;

  for (let index = 0; index < options.length; index += 1) {
    const height = parseQualityLabel(options[index]?.label ?? "")?.height ?? 0;
    if (height > 0 && height < lowestHeight) {
      lowestHeight = height;
      bestIndex = index;
    }
  }

  return lowestHeight === Number.POSITIVE_INFINITY ? 0 : bestIndex;
};
