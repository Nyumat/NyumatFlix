"use client";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  isScrapeServer,
  scrapeServer,
  usePlaybackModeStore,
  useServerStore,
} from "@/lib/stores/server-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import { getPlaybackModePolicy } from "@/lib/flags/site-flags";
import { useEffect, useRef } from "react";

function hasSavedPlaybackServer(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return Boolean(
      localStorage.getItem("playback-mode-storage") ||
        localStorage.getItem("video-server-storage"),
    );
  } catch {
    return false;
  }
}

export function AppSettingsSync() {
  const flags = useFeatureFlags();
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const playbackAudio = useAppSettingsStore((state) => state.playbackAudio);
  const setNoAdsMode = useAppSettingsStore((state) => state.setNoAdsMode);
  const setDisableHeroTrailers = useAppSettingsStore(
    (state) => state.setDisableHeroTrailers,
  );
  const selectedServer = useServerStore((state) => state.selectedServer);
  const setSelectedServer = useServerStore((state) => state.setSelectedServer);
  const seededNoAdsFromFlagRef = useRef(false);
  const seededProxyFromFlagRef = useRef(false);
  const seededHeroTrailersRef = useRef(false);
  const seededPlaybackAudioRef = useRef(false);

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
      if (
        policy === "choice" &&
        flags.defaultProxyPlayback &&
        !hasSavedPlaybackServer() &&
        !seededProxyFromFlagRef.current
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
  }, [
    flags,
    noAdsMode,
    selectedServer.id,
    setDisableHeroTrailers,
    setNoAdsMode,
    setSelectedServer,
  ]);

  return null;
}
