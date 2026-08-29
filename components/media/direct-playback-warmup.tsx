"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { prefetchDirectPlayerModules } from "@/lib/direct/prefetch-playback-player";
import {
  loadMoviPlayer,
  MOVI_PLAYER_SCRIPT,
} from "@/lib/movi/load-movi-player";
import { usePlaybackModeStore } from "@/lib/stores/playback-mode-store";
import { isScrapeServer } from "@/lib/stores/server-store";

const MOVI_SERVICE_WORKER = "/movi-player-sw.js";

const DETAIL_PAGE_PATTERN = /^\/(movies|tvshows)\/[^/]+/;

/**
 * Warms direct-playback assets when the user is likely to need them:
 * - on movie/TV detail pages (modulepreload + player chunks)
 * - anywhere when PROXY/Direct scrape mode is selected (movi decoder + chunks)
 */
export function DirectPlaybackWarmup() {
  const pathname = usePathname();
  const selectedServer = usePlaybackModeStore((state) => state.selectedServer);
  const { directScrapeProviderAvailable } = useFeatureFlags();

  const onDetailPage = DETAIL_PAGE_PATTERN.test(pathname);
  const usesDirectPlayback =
    directScrapeProviderAvailable && isScrapeServer(selectedServer);
  const shouldWarm = onDetailPage || usesDirectPlayback;

  useEffect(() => {
    if (!shouldWarm) {
      return;
    }

    prefetchDirectPlayerModules();

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register(MOVI_SERVICE_WORKER)
        .catch(() => undefined);
    }

    if (usesDirectPlayback) {
      void loadMoviPlayer();
    }
  }, [shouldWarm, usesDirectPlayback]);

  if (!shouldWarm) {
    return null;
  }

  return <link rel="modulepreload" href={MOVI_PLAYER_SCRIPT} />;
}
