"use client";

import { FLAGS_UPDATED_BROADCAST_CHANNEL } from "@/lib/flags/flags-sync";
import { fetchSiteFlags } from "@/lib/flags/site-flags-client";
import type { SiteFlags } from "@/lib/flags/site-flags";
import { getDefaultSiteFlags } from "@/lib/flags/site-flags";
import { createContext, useContext, useEffect, useState } from "react";

const FeatureFlagsContext = createContext<SiteFlags | null>(null);
const FeatureFlagsReadyContext = createContext(false);

export function FeatureFlagsProvider({
  flags: flagsOverride,
  initialFlags,
  children,
}: {
  flags?: SiteFlags;
  initialFlags?: SiteFlags;
  children: React.ReactNode;
}) {
  const [fetchedFlags, setFetchedFlags] = useState<SiteFlags>(
    initialFlags ?? getDefaultSiteFlags(),
  );
  const [fetchedReady, setFetchedReady] = useState(Boolean(initialFlags));
  const flags = flagsOverride ?? fetchedFlags;
  const ready = Boolean(flagsOverride) || fetchedReady;

  useEffect(() => {
    if (flagsOverride) {
      return;
    }

    let cancelled = false;

    const apply = (force: boolean) => {
      void fetchSiteFlags({ force }).then((data) => {
        if (cancelled || !data) {
          return;
        }
        setFetchedFlags(data);
        setFetchedReady(true);
      });
    };

    apply(false);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(FLAGS_UPDATED_BROADCAST_CHANNEL);
        channel.onmessage = () => {
          apply(true);
        };
      } catch {
        channel = null;
      }
    }

    return () => {
      cancelled = true;
      channel?.close();
    };
  }, [flagsOverride]);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      <FeatureFlagsReadyContext.Provider value={ready}>
        {children}
      </FeatureFlagsReadyContext.Provider>
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

export function useFeatureFlagsReady(): boolean {
  return useContext(FeatureFlagsReadyContext);
}

export function useFeatureFlagsOptional(): SiteFlags | null {
  return useContext(FeatureFlagsContext);
}
