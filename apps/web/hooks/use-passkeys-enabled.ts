"use client";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";

export function usePasskeysEnabled(): boolean {
  const { passkeysEnabled } = useFeatureFlags();
  return passkeysEnabled;
}
