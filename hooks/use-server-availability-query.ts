"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildServerAvailabilityKey } from "@/lib/server-availability-key";
import { queryKeys } from "@/lib/query-keys";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import type { ServerAvailabilityInput } from "@/lib/stores/embed-server-store";
import { useServerStore } from "@/lib/stores/server-store";

export function useServerAvailabilityQuery(
  input: ServerAvailabilityInput | null,
) {
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const vidsrcApi = useServerStore((state) => state.vidsrcApi);
  const prefetchServerAvailability = useServerStore(
    (state) => state.prefetchServerAvailability,
  );

  const availabilityKey = useMemo(() => {
    if (!input) {
      return null;
    }
    return buildServerAvailabilityKey(input, vidsrcApi);
  }, [input, vidsrcApi]);

  useQuery({
    queryKey: queryKeys.serverAvailability(availabilityKey ?? "disabled"),
    queryFn: async () => {
      if (!input) {
        return null;
      }
      await prefetchServerAvailability(input);
      return null;
    },
    enabled: Boolean(availabilityKey) && !noAdsMode,
    staleTime: 5 * 60 * 1000,
  });
}
