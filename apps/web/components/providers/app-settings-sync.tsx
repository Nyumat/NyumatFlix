"use client";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  resolveEffectiveSettings,
  type UserPlaybackChoices,
} from "@/lib/flags/effective-settings";
import {
  isScrapeServer,
  usePlaybackModeStore,
  useServerStore,
} from "@/lib/stores/server-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import { useEffect, useRef } from "react";

export function AppSettingsSync() {
  const flags = useFeatureFlags();
  const playbackAudio = useAppSettingsStore((state) => state.playbackAudio);
  const setNoAdsMode = useAppSettingsStore((state) => state.setNoAdsMode);
  const setDisableHeroTrailers = useAppSettingsStore(
    (state) => state.setDisableHeroTrailers,
  );
  const setSelectedServer = useServerStore((state) => state.setSelectedServer);
  const lastPolicyGenerationRef = useRef<string | null>(null);

  useEffect(() => {
    useEmbedServerStore.getState().setAnimePreference(playbackAudio);
  }, [playbackAudio]);

  useEffect(() => {
    const playbackState = usePlaybackModeStore.getState();
    const appState = useAppSettingsStore.getState();

    const userChoices: UserPlaybackChoices = {
      noAdsMode: appState.noAdsMode,
      disableHeroTrailers: appState.disableHeroTrailers,
      selectedServerId: playbackState.selectedServer.id,
      userSelectedPlaybackServer: playbackState.hasUserSelectedPlaybackServer,
      policyGenerationAtChoice:
        playbackState.policyGenerationAtChoice ?? undefined,
    };

    const effective = resolveEffectiveSettings(flags, userChoices);
    const policyChanged =
      lastPolicyGenerationRef.current !== null &&
      lastPolicyGenerationRef.current !== flags.policyGeneration;

    if (
      effective.noAdsMode !== appState.noAdsMode ||
      (policyChanged && flags.noAdsModeDefault)
    ) {
      setNoAdsMode(effective.noAdsMode);
    }

    if (
      effective.disableHeroTrailers !== appState.disableHeroTrailers ||
      (policyChanged && flags.staticHeroBackdrops)
    ) {
      setDisableHeroTrailers(effective.disableHeroTrailers);
    }

    const currentServerId = playbackState.selectedServer.id;
    const effectiveServerId = effective.selectedServer.id;
    const shouldForceServer =
      policyChanged ||
      currentServerId !== effectiveServerId ||
      effective.hasUserSelectedPlaybackServer !==
        playbackState.hasUserSelectedPlaybackServer;

    if (shouldForceServer) {
      setSelectedServer(effective.selectedServer, {
        userInitiated: effective.hasUserSelectedPlaybackServer,
        policyGenerationAtChoice: flags.policyGeneration,
      });
      if (!effective.hasUserSelectedPlaybackServer) {
        usePlaybackModeStore.setState({
          hasUserSelectedPlaybackServer: false,
          policyGenerationAtChoice: flags.policyGeneration,
        });
      }
    }

    lastPolicyGenerationRef.current = flags.policyGeneration;
  }, [flags, setDisableHeroTrailers, setNoAdsMode, setSelectedServer]);

  return null;
}
