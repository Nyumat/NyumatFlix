"use client";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  isScrapeServer,
  scrapeServer,
  useServerStore,
} from "@/lib/stores/server-store";
import { getPlaybackModePolicy } from "@/lib/flags/site-flags";
import { useEffect, useRef } from "react";

export function AppSettingsSync() {
  const flags = useFeatureFlags();
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const setNoAdsMode = useAppSettingsStore((state) => state.setNoAdsMode);
  const setDisableHeroTrailers = useAppSettingsStore(
    (state) => state.setDisableHeroTrailers,
  );
  const selectedServer = useServerStore((state) => state.selectedServer);
  const setSelectedServer = useServerStore((state) => state.setSelectedServer);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      if (flags.noAdsModeDefault) {
        setNoAdsMode(true);
      }
      if (flags.staticHeroBackdrops) {
        setDisableHeroTrailers(true);
      }
    }

    const policy = getPlaybackModePolicy(flags);
    if (policy === "proxy") {
      setNoAdsMode(true);
      setSelectedServer(scrapeServer);
      return;
    }
    if (policy === "iframe" && isScrapeServer(selectedServer)) {
      setNoAdsMode(false);
    }
    if (noAdsMode && !isScrapeServer(selectedServer)) {
      setSelectedServer(scrapeServer);
    }
  }, [
    flags,
    noAdsMode,
    selectedServer,
    setDisableHeroTrailers,
    setNoAdsMode,
    setSelectedServer,
  ]);

  return null;
}
