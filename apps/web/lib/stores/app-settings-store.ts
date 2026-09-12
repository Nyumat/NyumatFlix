import { create } from "zustand";

import {
  DEFAULT_PLAYBACK_PREFERENCES,
  type PlaybackAudioPreference,
  type PlaybackQualityPreference,
  type PlaybackPreferences,
} from "@/lib/playback/playback-preferences";
import { patchUserSettings } from "@/lib/user/patch-user-settings";

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

export const useAppSettingsStore = create<AppSettingsState>()((set) => ({
  ...DEFAULT_PLAYBACK_PREFERENCES,
  noAdsMode: false,
  disableHeroTrailers: false,
  disableHoverSound: false,
  setNoAdsMode: (enabled) => set({ noAdsMode: enabled }),
  setDisableHeroTrailers: (enabled) => {
    set({ disableHeroTrailers: enabled });
    void patchUserSettings({ disableHeroTrailers: enabled });
  },
  setDisableHoverSound: (enabled) => {
    set({ disableHoverSound: enabled });
    void patchUserSettings({ disableHoverSound: enabled });
  },
  setPlaybackAudio: (playbackAudio) => {
    set({ playbackAudio });
    void patchUserSettings({ playbackAudio });
  },
  setPlaybackQuality: (playbackQuality) => {
    set({ playbackQuality });
    void patchUserSettings({ playbackQuality });
  },
  setPlaybackEnglishSubtitles: (playbackEnglishSubtitles) => {
    set({ playbackEnglishSubtitles });
    void patchUserSettings({ playbackEnglishSubtitles });
  },
}));
