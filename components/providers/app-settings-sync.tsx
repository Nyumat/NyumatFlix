"use client";

import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  isScrapeServer,
  scrapeServer,
  useServerStore,
} from "@/lib/stores/server-store";
import { useEffect } from "react";

export function AppSettingsSync() {
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const selectedServer = useServerStore((state) => state.selectedServer);
  const setSelectedServer = useServerStore((state) => state.setSelectedServer);

  useEffect(() => {
    if (noAdsMode && !isScrapeServer(selectedServer)) {
      setSelectedServer(scrapeServer);
    }
  }, [noAdsMode, selectedServer, setSelectedServer]);

  return null;
}
