"use client";

import { useFeatureFlagsOptional } from "@/components/providers/feature-flags-provider";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  isScrapeServer,
  scrapeServer,
  useServerStore,
} from "@/lib/stores/server-store";
import { getPlaybackModePolicy } from "@/lib/flags/site-flags";
import { useEffect, useRef } from "react";

export function AppSettingsSync() {
  const flags = useFeatureFlagsOptional();
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const setNoAdsMode = useAppSettingsStore((state) => state.setNoAdsMode);
  const setDisableHeroTrailers = useAppSettingsStore(
    (state) => state.setDisableHeroTrailers,
  );
  const selectedServer = useServerStore((state) => state.selectedServer);
  const setSelectedServer = useServerStore((state) => state.setSelectedServer);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!flags || seededRef.current) return;
    seededRef.current = true;
    if (flags.noAdsModeDefault) {
      setNoAdsMode(true);
    }
    if (flags.staticHeroBackdrops) {
      setDisableHeroTrailers(true);
    }
  }, [flags, setDisableHeroTrailers, setNoAdsMode]);

  useEffect(() => {
    if (!flags) return;
    const policy = getPlaybackModePolicy(flags);
    if (policy === "proxy") {
      setNoAdsMode(true);
      setSelectedServer(scrapeServer);
      return;
    }
    if (policy === "iframe" && isScrapeServer(selectedServer)) {
      setNoAdsMode(false);
    }
  }, [flags, selectedServer, setNoAdsMode, setSelectedServer]);

  useEffect(() => {
    if (noAdsMode && !isScrapeServer(selectedServer)) {
      setSelectedServer(scrapeServer);
    }
  }, [noAdsMode, selectedServer, setSelectedServer]);

  return null;
}
