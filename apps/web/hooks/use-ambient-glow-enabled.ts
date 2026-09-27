"use client";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";

export function useAmbientGlowEnabled(): boolean {
  const { ambientGlowEnabled } = useFeatureFlags();
  return ambientGlowEnabled;
}
