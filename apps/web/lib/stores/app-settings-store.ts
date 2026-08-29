import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_PLAYBACK_PREFERENCES,
  type PlaybackAudioPreference,
  type PlaybackQualityPreference,
  type PlaybackPreferences,
} from "@/lib/playback/playback-preferences";

interface AppSettingsState extends PlaybackPreferences {
  noAdsMode: boolean;
  disableHeroTrailers: boolean;
  disableHoverSound: boolean;
  setNoAdsMode: (enabled: boolean) => void;
  setDisableHeroTrailers: (enabled: boolean) => void;
  setDisableHoverSound: (enabled: boolean) => void;
  setPlaybackAudio: (audio: PlaybackAudioPreference) => void;
  setPlaybackQuality: (quality: PlaybackQualityPreference) => void;
  setPlaybackEnglishSubtitles: (enabled: boolean) => void;
}

export const getPlaybackPreferences = (): PlaybackPreferences => {
  const state = useAppSettingsStore.getState();
  return {
    playbackAudio: state.playbackAudio,
    playbackQuality: state.playbackQuality,
    playbackEnglishSubtitles: state.playbackEnglishSubtitles,
  };
};

export type {
  PlaybackAudioPreference,
  PlaybackQualityPreference,
  PlaybackPreferences,
} from "@/lib/playback/playback-preferences";

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PLAYBACK_PREFERENCES,
      noAdsMode: false,
      disableHeroTrailers: false,
      disableHoverSound: false,
      setNoAdsMode: (enabled) => set({ noAdsMode: enabled }),
      setDisableHeroTrailers: (enabled) =>
        set({ disableHeroTrailers: enabled }),
      setDisableHoverSound: (enabled) => set({ disableHoverSound: enabled }),
      setPlaybackAudio: (playbackAudio) => set({ playbackAudio }),
      setPlaybackQuality: (playbackQuality) => set({ playbackQuality }),
      setPlaybackEnglishSubtitles: (playbackEnglishSubtitles) =>
        set({ playbackEnglishSubtitles }),
    }),
    {
      name: "app-settings-storage",
    },
  ),
);
