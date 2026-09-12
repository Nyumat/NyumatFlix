"use client";

import { useCallback, useState } from "react";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { prefetchDirectPlayerModules } from "@/lib/direct/prefetch-playback-player";
import { loadMoviPlayer, MOVI_PLAYER_SCRIPT } from "@/lib/player/load-player";
import { usePlaybackModeStore } from "@/lib/stores/playback-mode-store";
import { isScrapeServer } from "@/lib/stores/server-store";

const PLAYER_SERVICE_WORKER = "/player-sw.js";

export const DETAIL_PAGE_PATTERN = /^\/(movies|tvshows|anime)\/[^/]+/;

type WarmDirectPlaybackOptions = {
  usesDirectPlayback?: boolean;
};

export function warmDirectPlaybackOnPlayIntent(
  options: WarmDirectPlaybackOptions = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  prefetchDirectPlayerModules();

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
      .register(PLAYER_SERVICE_WORKER)
      .catch(() => undefined);
  }

  if (options.usesDirectPlayback) {
    void loadMoviPlayer();
  }
}

export function usePlayIntentDirectPlaybackWarmup() {
  const selectedServer = usePlaybackModeStore((state) => state.selectedServer);
  const { directScrapeProviderAvailable } = useFeatureFlags();
  const [shouldPreloadMovi, setShouldPreloadMovi] = useState(false);

  const usesDirectPlayback =
    directScrapeProviderAvailable && isScrapeServer(selectedServer);

  const warmPlayback = useCallback(() => {
    warmDirectPlaybackOnPlayIntent({ usesDirectPlayback });
    if (usesDirectPlayback) {
      setShouldPreloadMovi(true);
    }
  }, [usesDirectPlayback]);

  const preloadLink =
    shouldPreloadMovi && usesDirectPlayback ? (
      <link rel="modulepreload" href={MOVI_PLAYER_SCRIPT} />
    ) : null;

  return { warmPlayback, preloadLink };
}
