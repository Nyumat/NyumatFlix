"use client";

import { getSession } from "next-auth/react";

import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { usePlaybackModeStore } from "@/lib/stores/playback-mode-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import type { UserSettingsWire } from "@/lib/user/user-settings-types";
import { setSubtitleAppearance } from "@/lib/playback/subtitle-appearance-storage";

let hydrated = false;

export const hydrateUserSettings = async (): Promise<void> => {
  const session = await getSession();
  if (!session?.user?.id) {
    hydrated = false;
    return;
  }

  const response = await fetch("/api/user/settings");
  if (!response.ok) {
    return;
  }

  const payload = (await response.json()) as { settings: UserSettingsWire };
  const settings = payload.settings;

  useAppSettingsStore.setState({
    playbackAudio: settings.playbackAudio,
    playbackQuality: settings.playbackQuality,
    playbackEnglishSubtitles: settings.playbackEnglishSubtitles,
    disableHoverSound: settings.disableHoverSound,
    disableHeroTrailers: settings.disableHeroTrailers,
  });

  useEmbedServerStore.setState({
    vidnestContentType: settings.vidnestContentType,
    vidsrcApi: settings.vidsrcApi,
    animePreference: settings.playbackAudio,
  });

  if (settings.subtitleAppearance) {
    setSubtitleAppearance(settings.subtitleAppearance);
  }

  if (settings.selectedServerId) {
    const { resolveVideoServerById } = await import(
      "@/lib/stores/video-servers"
    );
    const server = resolveVideoServerById(settings.selectedServerId);
    if (server) {
      usePlaybackModeStore.setState({
        selectedServer: server,
        hasUserSelectedPlaybackServer: settings.userSelectedPlaybackServer,
        policyGenerationAtChoice: settings.policyGenerationAtChoice,
      });
    }
  }

  hydrated = true;
};

export const isUserSettingsHydrated = (): boolean => hydrated;
