import type { VideoServer } from "@/lib/stores/video-servers";

import { isTmdbScrapeProvider } from "@/lib/providers/registry";
import type { ScrapeItem } from "./types";

export type EmbedAvailabilityStatus = "available" | "unavailable" | "unknown";

export type SourceOverlayItem = {
  id: string;
  name: string;
  kind: "scrape" | "embed";
  status: ScrapeItem["status"] | EmbedAvailabilityStatus;
  error?: string;
};

const embedAvailabilityRank = (
  serverId: string,
  availableServerIds: string[],
  unavailableServerIds: string[],
): number => {
  if (availableServerIds.includes(serverId)) return 0;
  if (unavailableServerIds.includes(serverId)) return 2;
  return 1;
};

export function buildSourceOverlayItems(input: {
  scrapeItems: ScrapeItem[];
  embedServers: VideoServer[];
  availableServerIds: string[];
  unavailableServerIds: string[];
}): SourceOverlayItem[] {
  const scrapeItems: SourceOverlayItem[] = input.scrapeItems.map((item) => ({
    id: item.providerId,
    name: item.name,
    kind: "scrape",
    status: item.status,
    error: item.error,
  }));

  const embedOnlyServers = input.embedServers.filter(
    (server) => !isTmdbScrapeProvider(server.id),
  );

  const embedItems: SourceOverlayItem[] = [...embedOnlyServers]
    .sort((left, right) => {
      const rankDelta =
        embedAvailabilityRank(
          left.id,
          input.availableServerIds,
          input.unavailableServerIds,
        ) -
        embedAvailabilityRank(
          right.id,
          input.availableServerIds,
          input.unavailableServerIds,
        );
      if (rankDelta !== 0) {
        return rankDelta;
      }

      return (
        input.embedServers.findIndex((server) => server.id === left.id) -
        input.embedServers.findIndex((server) => server.id === right.id)
      );
    })
    .map((server) => ({
      id: server.id,
      name: server.name,
      kind: "embed" as const,
      status: input.unavailableServerIds.includes(server.id)
        ? ("unavailable" as const)
        : input.availableServerIds.includes(server.id)
          ? ("available" as const)
          : ("unknown" as const),
    }));

  return [...scrapeItems, ...embedItems];
}

export function sortServersByAvailability<T extends { id: string }>(
  servers: T[],
  availableServerIds: string[],
  unavailableServerIds: string[],
): T[] {
  return [...servers].sort((left, right) => {
    const rankDelta =
      embedAvailabilityRank(left.id, availableServerIds, unavailableServerIds) -
      embedAvailabilityRank(right.id, availableServerIds, unavailableServerIds);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return (
      servers.findIndex((server) => server.id === left.id) -
      servers.findIndex((server) => server.id === right.id)
    );
  });
}
