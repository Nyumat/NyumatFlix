import {
  isJapaneseAudioPreference,
  pickTrackIndexByLanguage,
  type TrackLanguageFields,
} from "@/lib/playback/track-matching";
import type { MoviPlayerElement } from "@/lib/player/player-element";
import {
  getTrackPreferences,
  type SubtitleTrackPreference,
} from "@/lib/playback/track-preferences-storage";

export type MoviSubtitleTrackFields = TrackLanguageFields & {
  id: string | number;
};

export const resolvePreferredSubtitleLang = (
  scopeKey: string,
  options?: {
    preferEnglishSubtitles?: boolean;
    preferredAudioLang?: string | null;
  },
): SubtitleTrackPreference | null => {
  const saved = getTrackPreferences(scopeKey)?.subtitleLang;
  if (saved) {
    return saved;
  }

  if (
    options?.preferEnglishSubtitles ||
    isJapaneseAudioPreference(options?.preferredAudioLang)
  ) {
    return "english";
  }

  return null;
};

const listExternalSubtitleTracks = (
  player: MoviPlayerElement,
): MoviSubtitleTrackFields[] =>
  (player.getSubtitleLangs?.() ?? []).map((track) => ({
    id: track.id,
    lang: track.lang,
    label: track.label,
  }));

const listMuxedSubtitleTracks = (
  player: MoviPlayerElement,
): MoviSubtitleTrackFields[] =>
  (player.getSubtitleTracks?.() ?? []).map((track) => ({
    id: track.id,
    language: track.language,
    label: track.label,
    lang: track.language,
  }));

export const readActiveMoviSubtitlePreference = (
  player: MoviPlayerElement,
): SubtitleTrackPreference => {
  const reader = (
    player as MoviPlayerElement & {
      getActiveSubtitlePreference?: () => string;
    }
  ).getActiveSubtitlePreference;

  if (typeof reader === "function") {
    return reader.call(player);
  }

  const activeExternal = listExternalSubtitleTracks(player).find((track) =>
    (player.getSubtitleLangs?.() ?? []).some(
      (entry) => entry.id === track.id && entry.active,
    ),
  );

  if (activeExternal) {
    return activeExternal.lang ?? activeExternal.label ?? "unknown";
  }

  return "off";
};

export const applyMoviSubtitlePreference = async (
  player: MoviPlayerElement,
  preferred: SubtitleTrackPreference | null | undefined,
): Promise<boolean> => {
  if (!preferred || preferred === "off") {
    await player.selectExternalSubtitle?.(null);
    await player.selectSubtitleTrack?.(null);
    return true;
  }

  const external = listExternalSubtitleTracks(player);
  if (external.length > 0) {
    const index = pickTrackIndexByLanguage(external, preferred);
    if (index != null) {
      const track = external[index];
      if (track && typeof track.id === "string") {
        return (await player.selectExternalSubtitle?.(track.id)) ?? false;
      }
    }
  }

  const muxed = listMuxedSubtitleTracks(player);
  if (muxed.length > 0) {
    const index = pickTrackIndexByLanguage(muxed, preferred);
    if (index != null) {
      const track = muxed[index];
      if (track && typeof track.id === "number") {
        return (await player.selectSubtitleTrack?.(track.id)) ?? false;
      }
    }
  }

  return false;
};
