"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryStaleTime } from "@/lib/cache-policy";
import type { MalSyncStatusResponse } from "@/lib/mal/types";

type MalSyncStatusOptions = {
  deferUntilIdleOrMenu?: boolean;
};

let malSyncStatusRequested = false;
const malSyncStatusListeners = new Set<() => void>();

export function enableMalSyncStatus(): void {
  if (malSyncStatusRequested) return;
  malSyncStatusRequested = true;
  for (const listener of malSyncStatusListeners) {
    listener();
  }
}

async function fetchMalStatus(): Promise<MalSyncStatusResponse> {
  const response = await fetch("/api/mal/status");
  if (!response.ok) {
    return { connected: false };
  }
  return (await response.json()) as MalSyncStatusResponse;
}

function useMalSyncStatusEnabled(deferUntilIdleOrMenu: boolean): boolean {
  const [enabled, setEnabled] = useState(
    !deferUntilIdleOrMenu || malSyncStatusRequested,
  );

  useEffect(() => {
    if (!deferUntilIdleOrMenu) {
      setEnabled(true);
      return;
    }

    if (malSyncStatusRequested) {
      setEnabled(true);
      return;
    }

    const onRequested = () => setEnabled(true);
    malSyncStatusListeners.add(onRequested);

    const idleHandle =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(() => setEnabled(true), { timeout: 5000 })
        : window.setTimeout(() => setEnabled(true), 5000);

    return () => {
      malSyncStatusListeners.delete(onRequested);
      if (typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleHandle as number);
      } else {
        window.clearTimeout(idleHandle as number);
      }
    };
  }, [deferUntilIdleOrMenu]);

  return enabled;
}

export function useMalSyncStatus(options?: MalSyncStatusOptions) {
  const deferUntilIdleOrMenu = options?.deferUntilIdleOrMenu ?? false;
  const enabled = useMalSyncStatusEnabled(deferUntilIdleOrMenu);

  return useQuery({
    queryKey: ["mal-status"],
    queryFn: fetchMalStatus,
    staleTime: queryStaleTime(60_000),
    enabled,
  });
}
