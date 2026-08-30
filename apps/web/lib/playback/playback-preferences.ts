import {
  parseQualityLabel,
  pickDefaultScrapeQualityIndex,
  type ScrapeQualityPlayOption,
} from "@/lib/scrape/player-sources";
import { looksLikeMultiTrackStream } from "@nyumatflix/playback";
import { isCatalogSubtitle } from "@/lib/scrape/subtitle-harvest";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";

export type PlaybackAudioPreference = "sub" | "dub";
export type PlaybackQualityPreference = "1080p" | "720p" | "480p";

export type PlaybackPreferences = {
  playbackAudio: PlaybackAudioPreference;
  playbackQuality: PlaybackQualityPreference;
  playbackEnglishSubtitles: boolean;
};

export const PLAYBACK_QUALITY_MIN_HEIGHT: Record<
  PlaybackQualityPreference,
  number
> = {
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
};

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  playbackAudio: "sub",
  playbackQuality: "1080p",
  playbackEnglishSubtitles: true,
};

const LEGACY_PLAYBACK_QUALITY: Record<string, PlaybackQualityPreference> = {
  best: "1080p",
  "save-data": "720p",
};

export const normalizePlaybackQualityPreference = (
  value: string | undefined,
): PlaybackQualityPreference => {
  if (value === "1080p" || value === "720p" || value === "480p") {
    return value;
  }
  return (
    LEGACY_PLAYBACK_QUALITY[value ?? ""] ??
    DEFAULT_PLAYBACK_PREFERENCES.playbackQuality
  );
};

const ADAPTIVE_QUALITY_NEUTRAL_HEIGHT = 720;

export type ScorableAnimeScrapePayload = {
  streamKind?: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
  preferredAudioLang?: string;
  audioVersions?: ScrapeAudioVersion[];
  nativeAudioTrackCount?: number;
  nativeSubtitleTrackCount?: number;
  directPlayback?: "hls" | "direct" | "extended";
  directStreamName?: string;
  directFileName?: string;
};

/** JustAnime Megaplay paths scrape fast but decode slowly — prefer direct HLS siblings. */
export const JUSTANIME_MEGAPLAY_SCORE_PENALTY = 800;

const MULTI_AUDIO_AND_SUBS_BONUS = 3_000;
const MULTI_AUDIO_BONUS = 2_000;
const NATIVE_SUBTITLE_MENU_BONUS = 400;
const ENGLISH_SUBTITLE_MATCH_BONUS = 500;
const ENGLISH_SUBTITLE_MISS_PENALTY = 20;
const AUDIO_PREFERENCE_MATCH_BONUS = 1_000;
const DUB_AVAILABLE_BONUS = 3_000;
const QUALITY_ABOVE_TARGET_BONUS_SCALE = 0.25;
const QUALITY_BELOW_TARGET_PENALTY_SCALE = 0.5;

const uniqueAudioVersionLangs = (
  audioVersions: ScrapeAudioVersion[] | undefined,
): number => {
  const langs = new Set<string>();
  for (const version of audioVersions ?? []) {
    const lang = version.lang.trim().toLowerCase();
    if (lang) {
      langs.add(lang);
    }
  }
  return langs.size;
};

export const payloadHasInPlayerAudioSwitching = (
  payload: ScorableAnimeScrapePayload,
): boolean => {
  if (uniqueAudioVersionLangs(payload.audioVersions) > 1) {
    return true;
  }

  if ((payload.nativeAudioTrackCount ?? 0) > 1) {
    return true;
  }

  return looksLikeMultiTrackStream({
    name: payload.directStreamName ?? "",
    fileName: payload.directFileName,
  });
};

export const payloadHasInPlayerSubtitleSwitching = (
  payload: ScorableAnimeScrapePayload,
): boolean => {
  if ((payload.nativeSubtitleTrackCount ?? 0) > 0) {
    return true;
  }

  const sidecar = (payload.subtitles ?? []).filter(
    (track) => !isCatalogSubtitle(track),
  );
  if (sidecar.length > 0) {
    return true;
  }

  return (payload.audioVersions ?? []).some(
    (version) => (version.subtitles?.length ?? 0) > 0,
  );
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

const audioVersionMatchesPreference = (
  lang: string,
  audio: PlaybackAudioPreference,
): boolean => {
  const normalized = lang.trim().toLowerCase();
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

export const getPayloadMaxQualityHeight = (
  payload: ScorableAnimeScrapePayload,
): number => {
  const heights = qualityHeightsFromPayload(payload.qualities);
  if (heights.length > 0) {
    return Math.max(...heights);
  }

  return 0;
};

export const payloadHasDubAudio = (
  payload: ScorableAnimeScrapePayload,
): boolean => payloadMatchesAudioPreference(payload, "dub");

/** First-win only for in-player sub/dub menus — not dedicated English Megaplay. */
export const payloadMatchesAnimeEarlyWin = (
  payload: ScorableAnimeScrapePayload & { providerId?: string },
): boolean => {
  if (payload.providerId === "justanime") {
    return false;
  }

  return (
    payloadHasDubAudio(payload) && payloadHasInPlayerAudioSwitching(payload)
  );
};

export const payloadMatchesAudioPreference = (
  payload: ScorableAnimeScrapePayload,
  audio: PlaybackAudioPreference,
): boolean => {
  const versionLangs = (payload.audioVersions ?? [])
    .map((version) => version.lang)
    .filter((lang) => lang.trim().length > 0);
  if (versionLangs.length > 0) {
    return versionLangs.some((lang) =>
      audioVersionMatchesPreference(lang, audio),
    );
  }

  if (matchesAudioPreference(payload.preferredAudioLang, audio)) {
    return true;
  }

  if (
    audio === "dub" &&
    (payload.nativeAudioTrackCount ?? 0) > 1 &&
    payloadHasInPlayerAudioSwitching(payload)
  ) {
    return true;
  }

  return false;
};

export const payloadMatchesQualityPreference = (
  payload: ScorableAnimeScrapePayload,
  quality: PlaybackQualityPreference,
): boolean => {
  const minHeight = PLAYBACK_QUALITY_MIN_HEIGHT[quality];
  const maxHeight = getPayloadMaxQualityHeight(payload);
  if (maxHeight >= minHeight) {
    return true;
  }

  if (
    maxHeight === 0 &&
    (payload.streamKind === "hls" || payload.streamKind === "dash")
  ) {
    return minHeight <= ADAPTIVE_QUALITY_NEUTRAL_HEIGHT;
  }

  return false;
};

/** Early playback win — audio (and optional subs), not resolution. */
export const payloadMatchesCorePlaybackPreferences = (
  payload: ScorableAnimeScrapePayload,
  preferences: PlaybackPreferences,
): boolean => {
  if (!payloadMatchesAudioPreference(payload, preferences.playbackAudio)) {
    return false;
  }

  if (
    preferences.playbackEnglishSubtitles &&
    !hasEnglishSubtitles(payload.subtitles) &&
    !payloadHasInPlayerSubtitleSwitching(payload)
  ) {
    return false;
  }

  return true;
};

export const payloadMatchesPlaybackPreferences =
  payloadMatchesCorePlaybackPreferences;

export const scoreAnimeScrapePayload = (
  payload: ScorableAnimeScrapePayload,
  preferences: PlaybackPreferences,
): number => {
  let score = 0;
  const heights = qualityHeightsFromPayload(payload.qualities);
  const maxHeight =
    heights.length > 0 ? Math.max(...heights) : ADAPTIVE_QUALITY_NEUTRAL_HEIGHT;

  if (payloadMatchesAudioPreference(payload, preferences.playbackAudio)) {
    score += AUDIO_PREFERENCE_MATCH_BONUS;
  }

  if (payloadHasDubAudio(payload)) {
    score += DUB_AVAILABLE_BONUS;
  }

  const targetHeight = PLAYBACK_QUALITY_MIN_HEIGHT[preferences.playbackQuality];
  score +=
    Math.max(0, maxHeight - targetHeight) * QUALITY_ABOVE_TARGET_BONUS_SCALE;
  score += heights.length * 5;
  if (maxHeight < targetHeight) {
    score -= (targetHeight - maxHeight) * QUALITY_BELOW_TARGET_PENALTY_SCALE;
  }

  if (preferences.playbackEnglishSubtitles) {
    const hasSubs =
      hasEnglishSubtitles(payload.subtitles) ||
      payloadHasInPlayerSubtitleSwitching(payload);
    score += hasSubs
      ? ENGLISH_SUBTITLE_MATCH_BONUS
      : -ENGLISH_SUBTITLE_MISS_PENALTY;
  }

  const multiAudio = payloadHasInPlayerAudioSwitching(payload);
  const nativeSubs = payloadHasInPlayerSubtitleSwitching(payload);

  if (multiAudio && nativeSubs) {
    score += MULTI_AUDIO_AND_SUBS_BONUS;
  } else if (multiAudio) {
    score += MULTI_AUDIO_BONUS;
  } else if (nativeSubs) {
    score += NATIVE_SUBTITLE_MENU_BONUS;
  }

  return score;
};

export const scoreAnimePlaybackRacePayload = (
  payload: ScorableAnimeScrapePayload & { providerId?: string },
  preferences: PlaybackPreferences,
): number => {
  let score = scoreAnimeScrapePayload(payload, preferences);
  if (payload.providerId === "justanime") {
    score -= JUSTANIME_MEGAPLAY_SCORE_PENALTY;
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

  const targetHeight = PLAYBACK_QUALITY_MIN_HEIGHT[quality];
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < options.length; index += 1) {
    const height = parseQualityLabel(options[index]?.label ?? "")?.height ?? 0;
    if (height <= 0) {
      continue;
    }

    const distance =
      height >= targetHeight
        ? height - targetHeight
        : targetHeight - height + 1_000;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  if (bestDistance === Number.POSITIVE_INFINITY) {
    return pickDefaultScrapeQualityIndex(options);
  }

  return bestIndex;
};
