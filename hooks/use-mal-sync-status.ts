"use client";

import { useQuery } from "@tanstack/react-query";
import { queryStaleTime } from "@/lib/cache-policy";
import type { MalSyncStatusResponse } from "@/lib/mal/types";

async function fetchMalStatus(): Promise<MalSyncStatusResponse> {
  const response = await fetch("/api/mal/status");
  if (!response.ok) {
    return { connected: false };
  }
  return (await response.json()) as MalSyncStatusResponse;
}

export function useMalSyncStatus() {
  return useQuery({
    queryKey: ["mal-status"],
    queryFn: fetchMalStatus,
    staleTime: queryStaleTime(60_000),
  });
}
