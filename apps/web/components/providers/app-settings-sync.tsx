"use client";

import {
  useFeatureFlags,
  useFeatureFlagsReady,
} from "@/components/providers/feature-flags-provider";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  resolveEffectiveSettings,
  type UserPlaybackChoices,
} from "@/lib/flags/effective-settings";
import {
  usePlaybackModeStore,
  useServerStore,
} from "@/lib/stores/server-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import { useEffect, useRef } from "react";
import { isUserSettingsHydrated } from "@/lib/user/hydrate-user-settings";

export function AppSettingsSync() {
  const flags = useFeatureFlags();
  const flagsReady = useFeatureFlagsReady();
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
    if (!flagsReady) {
      return;
    }

    const playbackState = usePlaybackModeStore.getState();
    const appState = useAppSettingsStore.getState();

    // Hydration from /api/user/settings lands after first paint. Don't force
    // policy-selected servers/modes until
    // the persisted choice is in — otherwise the page flips mid-scroll once
    // hydration lands and re-resolves against stale defaults.
    // Policy *locks* (proxy-only / iframe-only) still apply immediately.
    const settingsHydrated = isUserSettingsHydrated();
    const policyIsLock = flags.proxyModeOnly || flags.iframeModeOnly;

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

    // Gate *derived* writes on hydration so the first policy pass (which runs
    // against store defaults before /api/user/settings lands) doesn't flip
    // mode/server mid-scroll. Locks (proxy-only / iframe-only) bypass the
    // gate because they are authoritative, not derived. An explicit operator
    // default (defaultProxyPlayback / noAdsModeDefault) is also authoritative
    // on first paint — the user hasn't chosen anything yet, so seeding the
    // flagged default immediately is the stable outcome, not a flip.
    const operatorDefaultPlayback =
      flags.defaultProxyPlayback || flags.noAdsModeDefault;
    const allowDerivedWrites =
      settingsHydrated ||
      policyIsLock ||
      policyChanged ||
      operatorDefaultPlayback;

    if (
      allowDerivedWrites &&
      (effective.noAdsMode !== appState.noAdsMode ||
        (policyChanged && flags.noAdsModeDefault))
    ) {
      setNoAdsMode(effective.noAdsMode);
    }

    if (
      allowDerivedWrites &&
      (effective.disableHeroTrailers !== appState.disableHeroTrailers ||
        (policyChanged && flags.staticHeroBackdrops))
    ) {
      setDisableHeroTrailers(effective.disableHeroTrailers);
    }

    const currentServerId = playbackState.selectedServer.id;
    const effectiveServerId = effective.selectedServer.id;
    const shouldForceServer =
      policyIsLock ||
      policyChanged ||
      // On first run pre-hydration, the selected server is just the store
      // default — resolving policy against it would swap mid-scroll. Wait for
      // hydrateUserSettings() unless a hard lock demands otherwise.
      (allowDerivedWrites &&
        (currentServerId !== effectiveServerId ||
          effective.hasUserSelectedPlaybackServer !==
            playbackState.hasUserSelectedPlaybackServer));

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
  }, [
    flags,
    flagsReady,
    setDisableHeroTrailers,
    setNoAdsMode,
    setSelectedServer,
  ]);

  return null;
}
