"use client";

import {
  useFeatureFlags,
  useFeatureFlagsReady,
} from "@/components/providers/feature-flags-provider";
import {
  readStoredPlayerEngine,
  writePlayerEnginePreference,
} from "@/hooks/use-movi-preview";
import {
  resolveExperiencePreferences,
  storedFromUserSettingsWire,
  type StoredExperiencePreferences,
} from "@/lib/flags/experience-defaults";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import { persistAmbientGlowClient } from "@/lib/user/ambient-glow-store";
import {
  persistCatalogCardStyleClient,
  readDeviceCatalogCardStyle,
} from "@/lib/user/catalog-card-style-store";
import { isUserSettingsHydrated } from "@/lib/user/hydrate-user-settings";
import type { UserSettingsWire } from "@/lib/user/user-settings-types";
import { useEffect, useRef } from "react";

export const applyResolvedExperiencePreferences = (
  flags: ReturnType<typeof useFeatureFlags>,
  stored: StoredExperiencePreferences,
  options?: { persistCatalogCardStyle?: boolean; persistAmbientGlow?: boolean },
): void => {
  const resolved = resolveExperiencePreferences(flags, stored);

  useAppSettingsStore.setState({
    playbackAudio: resolved.playbackAudio,
    playbackQuality: resolved.playbackQuality,
    playbackEnglishSubtitles: resolved.playbackEnglishSubtitles,
    disableHoverSound: resolved.disableHoverSound,
    disableHeroTrailers: resolved.disableHeroTrailers,
    ambientGlow: resolved.ambientGlow,
    catalogCardStyle: resolved.catalogCardStyle,
  });

  useEmbedServerStore.setState({
    vidnestContentType: resolved.vidnestContentType,
    vidsrcApi: resolved.vidsrcApi,
    animePreference: resolved.playbackAudio,
  });

  if (resolved.locks.playerEngine) {
    writePlayerEnginePreference(resolved.playerEngine);
  }

  if (options?.persistCatalogCardStyle) {
    persistCatalogCardStyleClient(resolved.catalogCardStyle);
  }

  if (options?.persistAmbientGlow) {
    persistAmbientGlowClient(resolved.ambientGlow);
  }
};

export const applyExperienceFromUserSettings = (
  flags: ReturnType<typeof useFeatureFlags>,
  settings: UserSettingsWire,
): void => {
  const stored: StoredExperiencePreferences = {
    ...storedFromUserSettingsWire(settings),
    playerEngine: readStoredPlayerEngine(),
    catalogCardStyle: settings.catalogCardStyle ?? readDeviceCatalogCardStyle(),
  };

  applyResolvedExperiencePreferences(flags, stored, {
    persistCatalogCardStyle: settings.catalogCardStyle !== null,
    persistAmbientGlow: settings.ambientGlow !== null,
  });
};

export function ExperienceSettingsSync() {
  const flags = useFeatureFlags();
  const flagsReady = useFeatureFlagsReady();
  const lastGenerationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flagsReady) {
      return;
    }

    const settingsHydrated = isUserSettingsHydrated();
    if (settingsHydrated) {
      return;
    }

    const stored: StoredExperiencePreferences = {
      playerEngine: readStoredPlayerEngine(),
      catalogCardStyle: readDeviceCatalogCardStyle(),
    };

    applyResolvedExperiencePreferences(flags, stored);
    lastGenerationRef.current = JSON.stringify(flags.experienceDefaults);
  }, [flags, flagsReady]);

  useEffect(() => {
    if (!flagsReady) {
      return;
    }

    const serialized = JSON.stringify(flags.experienceDefaults);
    if (lastGenerationRef.current === serialized) {
      return;
    }
    lastGenerationRef.current = serialized;

    if (isUserSettingsHydrated()) {
      return;
    }

    const stored: StoredExperiencePreferences = {
      playerEngine: readStoredPlayerEngine(),
      catalogCardStyle: readDeviceCatalogCardStyle(),
    };

    applyResolvedExperiencePreferences(flags, stored);
  }, [flags, flagsReady]);

  return null;
}
