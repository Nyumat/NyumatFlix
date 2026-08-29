"use client";

import { useQuery } from "@tanstack/react-query";
import { queryStaleTime } from "@/lib/cache-policy";
import type { MalListIndex } from "@/lib/mal/list-index-shared";
import { useMalSyncStatus } from "./use-mal-sync-status";

async function fetchMalListIndex(): Promise<MalListIndex> {
  const response = await fetch("/api/mal/list");
  if (!response.ok) {
    throw new Error("Failed to load MyAnimeList");
  }
  return (await response.json()) as MalListIndex;
}

export function useMalListIndex() {
  const malStatusQuery = useMalSyncStatus();
  const malConnected = malStatusQuery.data?.connected === true;

  const listQuery = useQuery({
    queryKey: ["mal-list-index"],
    queryFn: fetchMalListIndex,
    enabled: malConnected,
    staleTime: queryStaleTime(30_000),
  });

  return {
    malConnected,
    malStatusQuery,
    listQuery,
    items: listQuery.data?.items ?? [],
    isLoading:
      malStatusQuery.isLoading || (malConnected && listQuery.isLoading),
  };
}
