import { create } from "zustand";

import {
  DEFAULT_PLAYBACK_PREFERENCES,
  type PlaybackAudioPreference,
  type PlaybackQualityPreference,
  type PlaybackPreferences,
} from "@/lib/playback/playback-preferences";
import { patchUserSettings } from "@/lib/user/patch-user-settings";
import {
  persistAmbientGlowClient,
  readAmbientGlowClient,
} from "@/lib/user/ambient-glow-store";
import {
  persistCatalogCardStyleClient,
  readCatalogCardStyleClient,
} from "@/lib/user/catalog-card-style-store";
import type { CatalogCardStyle } from "@/lib/user/user-settings-types";

interface AppSettingsState extends PlaybackPreferences {
  noAdsMode: boolean;
  disableHeroTrailers: boolean;
  ambientGlow: boolean;
  disableHoverSound: boolean;
  catalogCardStyle: CatalogCardStyle;
  setNoAdsMode: (enabled: boolean) => void;
  setDisableHeroTrailers: (enabled: boolean) => void;
  setAmbientGlow: (enabled: boolean) => void;
  setDisableHoverSound: (enabled: boolean) => void;
  setCatalogCardStyle: (style: CatalogCardStyle) => void;
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
  // Slice runs during SSR too — resolve persisted prefs lazily on the client
  // so first paint already matches (no mid-scroll / settings flip).
  ambientGlow: readAmbientGlowClient() ?? false,
  disableHoverSound: true,
  catalogCardStyle: readCatalogCardStyleClient() ?? "backdrop",
  setNoAdsMode: (enabled) => set({ noAdsMode: enabled }),
  setDisableHeroTrailers: (enabled) => {
    set({ disableHeroTrailers: enabled });
    void patchUserSettings({ disableHeroTrailers: enabled });
  },
  setAmbientGlow: (enabled) => {
    persistAmbientGlowClient(enabled);
    set({ ambientGlow: enabled });
    void patchUserSettings({ ambientGlow: enabled });
  },
  setDisableHoverSound: (enabled) => {
    set({ disableHoverSound: enabled });
    void patchUserSettings({ disableHoverSound: enabled });
  },
  setCatalogCardStyle: (catalogCardStyle) => {
    // Persist synchronously (cookie + localStorage + <html> dataset) so the
    // very next paint — including Suspense fallbacks in other rows — already
    // uses the new style instead of flipping after hydration.
    persistCatalogCardStyleClient(catalogCardStyle);
    set({ catalogCardStyle });
    void patchUserSettings({ catalogCardStyle });
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
