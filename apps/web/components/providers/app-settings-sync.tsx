"use client";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { normalizePlaybackQualityPreference } from "@/lib/playback/playback-preferences";
import {
  isScrapeServer,
  scrapeServer,
  usePlaybackModeStore,
  useServerStore,
} from "@/lib/stores/server-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import {
  getPlaybackModePolicy,
  shouldSeedDefaultProxyPlayback,
} from "@/lib/flags/site-flags";
import { useEffect, useRef } from "react";

export function AppSettingsSync() {
  const flags = useFeatureFlags();
  const playbackAudio = useAppSettingsStore((state) => state.playbackAudio);
  const setNoAdsMode = useAppSettingsStore((state) => state.setNoAdsMode);
  const setDisableHeroTrailers = useAppSettingsStore(
    (state) => state.setDisableHeroTrailers,
  );
  const setSelectedServer = useServerStore((state) => state.setSelectedServer);
  const seededNoAdsFromFlagRef = useRef(false);
  const seededProxyFromFlagRef = useRef(false);
  const seededHeroTrailersRef = useRef(false);
  const seededPlaybackAudioRef = useRef(false);
  const seededPlaybackQualityRef = useRef(false);

  useEffect(() => {
    const migratePlaybackQuality = () => {
      if (seededPlaybackQualityRef.current) {
        return;
      }

      seededPlaybackQualityRef.current = true;

      try {
        const raw = localStorage.getItem("app-settings-storage");
        const parsed = raw
          ? (JSON.parse(raw) as { state?: { playbackQuality?: string } })
          : null;
        const quality = parsed?.state?.playbackQuality;
        if (quality === "best" || quality === "save-data") {
          useAppSettingsStore.setState({
            playbackQuality: normalizePlaybackQualityPreference(quality),
          });
        }
      } catch {
        void 0;
      }
    };

    migratePlaybackQuality();
    const unsub = useAppSettingsStore.persist.onFinishHydration(
      migratePlaybackQuality,
    );
    return unsub;
  }, []);

  useEffect(() => {
    const migratePlaybackAudio = () => {
      if (seededPlaybackAudioRef.current) {
        return;
      }

      seededPlaybackAudioRef.current = true;

      try {
        const raw = localStorage.getItem("app-settings-storage");
        const parsed = raw
          ? (JSON.parse(raw) as { state?: { playbackAudio?: string } })
          : null;
        if (parsed?.state?.playbackAudio !== undefined) {
          return;
        }
      } catch {
        void 0;
      }

      const embedPreference = useEmbedServerStore.getState().animePreference;
      if (embedPreference) {
        useAppSettingsStore.setState({ playbackAudio: embedPreference });
      }
    };

    migratePlaybackAudio();
    const unsub =
      useAppSettingsStore.persist.onFinishHydration(migratePlaybackAudio);
    return unsub;
  }, []);

  useEffect(() => {
    useEmbedServerStore.getState().setAnimePreference(playbackAudio);
  }, [playbackAudio]);

  useEffect(() => {
    const syncFromFlags = () => {
      if (flags.noAdsModeDefault && !seededNoAdsFromFlagRef.current) {
        seededNoAdsFromFlagRef.current = true;
        setNoAdsMode(true);
      }
      if (!flags.noAdsModeDefault) {
        if (seededNoAdsFromFlagRef.current) {
          setNoAdsMode(false);
        }
        seededNoAdsFromFlagRef.current = false;
      }

      if (flags.staticHeroBackdrops && !seededHeroTrailersRef.current) {
        seededHeroTrailersRef.current = true;
        setDisableHeroTrailers(true);
      }
      if (!flags.staticHeroBackdrops) {
        seededHeroTrailersRef.current = false;
      }

      const policy = getPlaybackModePolicy(flags);
      const playbackState = usePlaybackModeStore.getState();
      const persistApi = usePlaybackModeStore.persist;
      if (
        persistApi.hasHydrated() &&
        !seededProxyFromFlagRef.current &&
        shouldSeedDefaultProxyPlayback({
          policy,
          defaultProxyPlayback: flags.defaultProxyPlayback,
          hasUserSelectedPlaybackServer:
            playbackState.hasUserSelectedPlaybackServer,
          selectedServerIsScrape: isScrapeServer(playbackState.selectedServer),
        })
      ) {
        seededProxyFromFlagRef.current = true;
        setSelectedServer(scrapeServer);
      }
      if (!flags.defaultProxyPlayback) {
        seededProxyFromFlagRef.current = false;
      }

      const activeNoAdsMode = useAppSettingsStore.getState().noAdsMode;
      const activeServer = usePlaybackModeStore.getState().selectedServer;

      if (policy === "proxy") {
        setNoAdsMode(true);
        setSelectedServer(scrapeServer);
        return;
      }

      if (policy === "iframe" && isScrapeServer(activeServer)) {
        setNoAdsMode(false);
      }

      if (activeNoAdsMode && !isScrapeServer(activeServer)) {
        setSelectedServer(scrapeServer);
      }
    };

    syncFromFlags();

    const unsubPlaybackHydration =
      usePlaybackModeStore.persist.onFinishHydration(syncFromFlags);
    const unsubSettingsHydration =
      useAppSettingsStore.persist.onFinishHydration(syncFromFlags);

    return () => {
      unsubPlaybackHydration();
      unsubSettingsHydration();
    };
  }, [flags, setDisableHeroTrailers, setNoAdsMode, setSelectedServer]);

  return null;
}
