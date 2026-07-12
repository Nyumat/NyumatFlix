"use client";

import type { SiteFlags } from "@/lib/flags/site-flags";
import { createContext, useContext } from "react";

const FeatureFlagsContext = createContext<SiteFlags | null>(null);

export function FeatureFlagsProvider({
  flags,
  children,
}: {
  flags: SiteFlags;
  children: React.ReactNode;
}) {
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
