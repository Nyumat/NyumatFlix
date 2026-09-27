"use client";

import { applyExperienceFromUserSettings } from "@/components/providers/experience-settings-sync";
import { fetchSiteFlags } from "@/lib/flags/site-flags-client";
import { getDefaultSiteFlags } from "@/lib/flags/site-flags";
import { usePlaybackModeStore } from "@/lib/stores/playback-mode-store";
import type { UserSettingsWire } from "@/lib/user/user-settings-types";
import { setSubtitleAppearance } from "@/lib/playback/subtitle-appearance-storage";

let hydrated = false;

export const resetUserSettingsHydratedForTests = (): void => {
  hydrated = false;
};

export const hydrateUserSettings = async (userId: string): Promise<void> => {
  if (!userId) {
    hydrated = false;
    return;
  }

  const [settingsResponse, flags] = await Promise.all([
    fetch("/api/user/settings"),
    fetchSiteFlags(),
  ]);
  if (!settingsResponse.ok) {
    return;
  }

  const payload = (await settingsResponse.json()) as {
    settings: UserSettingsWire;
  };
  const settings = payload.settings;

  applyExperienceFromUserSettings(flags ?? getDefaultSiteFlags(), settings);

  if (settings.subtitleAppearance) {
    setSubtitleAppearance(settings.subtitleAppearance);
  }

  if (settings.selectedServerId) {
    const { resolveStoredServer } = await import(
      "@/lib/stores/playback-mode-store"
    );
    usePlaybackModeStore.setState({
      selectedServer: resolveStoredServer(settings.selectedServerId),
      hasUserSelectedPlaybackServer: settings.userSelectedPlaybackServer,
      policyGenerationAtChoice: settings.policyGenerationAtChoice,
    });
  }

  hydrated = true;
};

export const isUserSettingsHydrated = (): boolean => hydrated;
