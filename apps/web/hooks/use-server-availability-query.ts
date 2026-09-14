"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { queryStaleTime } from "@/lib/cache-policy";
import { buildServerAvailabilityKey } from "@/lib/server-availability-key";
import { queryKeys } from "@/lib/query-keys";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import type { ServerAvailabilityInput } from "@/lib/stores/embed-server-store";
import { useServerStore } from "@/lib/stores/server-store";

/**
 * Server health probes stay off the landing critical path: they enable on
 * Watch intent (playback started) or idle, never on hero mount. The 1.7s
 * `/api/servers/health` batch no longer contends with hero/season fetches.
 */
function useWatchIntentOrIdle(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let idleHandle: number | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;

    const markReady = () => setReady(true);
    const onPlayIntent = () => markReady();

    window.addEventListener("nyumatflix:watch-intent", onPlayIntent, {
      once: true,
    });
    if (typeof requestIdleCallback !== "undefined") {
      idleHandle = requestIdleCallback(markReady, { timeout: 8000 });
    } else {
      fallback = setTimeout(markReady, 8000);
    }

    return () => {
      window.removeEventListener("nyumatflix:watch-intent", onPlayIntent);
      if (typeof cancelIdleCallback !== "undefined" && idleHandle != null) {
        cancelIdleCallback(idleHandle);
      }
      if (fallback) clearTimeout(fallback);
    };
  }, [ready]);

  return ready;
}

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
  const deferredReady = useWatchIntentOrIdle();

  useQuery({
    queryKey: queryKeys.serverAvailability(availabilityKey ?? "disabled"),
    queryFn: async () => {
      if (!input) {
        return null;
      }
      await prefetchServerAvailability(input);
      return null;
    },
    enabled: Boolean(availabilityKey) && !noAdsMode && deferredReady,
    staleTime: queryStaleTime(5 * 60 * 1000),
  });
}
