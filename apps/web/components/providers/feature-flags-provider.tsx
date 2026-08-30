"use client";

import { FLAGS_UPDATED_BROADCAST_CHANNEL } from "@/lib/flags/flags-sync";
import type { SiteFlags } from "@/lib/flags/site-flags";
import { getDefaultSiteFlags } from "@/lib/flags/site-flags";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const FeatureFlagsContext = createContext<SiteFlags | null>(null);

async function fetchSiteFlags(signal?: AbortSignal): Promise<SiteFlags | null> {
  const response = await fetch("/api/site/flags", {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SiteFlags;
}

export function FeatureFlagsProvider({
  flags: flagsOverride,
  children,
}: {
  flags?: SiteFlags;
  children: React.ReactNode;
}) {
  const [fetchedFlags, setFetchedFlags] = useState<SiteFlags>(
    flagsOverride ?? getDefaultSiteFlags(),
  );
  const flags = flagsOverride ?? fetchedFlags;

  const refreshFlags = useCallback(async () => {
    try {
      const data = await fetchSiteFlags();
      if (data) {
        setFetchedFlags(data);
      }
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    if (flagsOverride) {
      return;
    }

    const controller = new AbortController();

    void fetchSiteFlags(controller.signal)
      .then((data) => {
        if (data) {
          setFetchedFlags(data);
        }
      })
      .catch(() => undefined);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshFlags();
      }
    };

    window.addEventListener("focus", refreshFlags);
    document.addEventListener("visibilitychange", onVisible);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(FLAGS_UPDATED_BROADCAST_CHANNEL);
        channel.onmessage = () => {
          void refreshFlags();
        };
      } catch {
        channel = null;
      }
    }

    return () => {
      controller.abort();
      window.removeEventListener("focus", refreshFlags);
      document.removeEventListener("visibilitychange", onVisible);
      channel?.close();
    };
  }, [flagsOverride, refreshFlags]);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): SiteFlags {
  const flags = useContext(FeatureFlagsContext);
  if (!flags) {
    throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  }
  return flags;
}

export function useFeatureFlagsOptional(): SiteFlags | null {
  return useContext(FeatureFlagsContext);
}
