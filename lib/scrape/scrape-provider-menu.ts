import {
  deprioritizeProviders,
  reorderProvidersWithPreferred,
} from "@/lib/scrape/provider-race";
import type { ScrapeItem, ScrapeItemStatus } from "@/lib/scrape/types";

export type ScrapeProviderOption = {
  providerId: string;
  name: string;
  group?: "anime" | "tmdb";
};

export type ScrapeProviderMenuEntry = ScrapeProviderOption & {
  status: ScrapeItemStatus | "idle";
  error?: string;
};

const failedStatuses = new Set<ScrapeItemStatus>(["failure", "unavailable"]);

export const isFailedScrapeStatus = (
  status: ScrapeItemStatus | "idle",
): boolean => status === "failure" || status === "unavailable";

const viableStatuses = new Set<ScrapeItemStatus | "idle">([
  "success",
  "waiting",
  "idle",
  "pending",
]);

/** True only when every provider in the chain is failure, unavailable, or skipped. */
export function areScrapeProvidersExhausted(
  scrapeItems: readonly ScrapeItem[],
  providerOrder: readonly string[],
): boolean {
  if (providerOrder.length === 0) {
    return true;
  }

  const itemById = new Map(
    scrapeItems.map((item) => [item.providerId, item] as const),
  );

  for (const providerId of providerOrder) {
    const status = itemById.get(providerId)?.status ?? "idle";
    if (viableStatuses.has(status)) {
      return false;
    }
  }

  return true;
}

export function pickPreferredProviderFromItems(
  scrapeItems: ScrapeItem[],
  activeProviderId?: string | null,
): string | undefined {
  if (
    activeProviderId &&
    scrapeItems.some(
      (item) =>
        item.providerId === activeProviderId && item.status === "success",
    )
  ) {
    return activeProviderId;
  }

  return scrapeItems.find((item) => item.status === "success")?.providerId;
}

export function sortScrapeProvidersForMenu<T extends ScrapeProviderOption>(
  providers: readonly T[],
  scrapeItems: readonly ScrapeItem[],
  activeProviderId?: string | null,
): T[] {
  if (providers.length === 0) {
    return [];
  }

  const failed = new Set(
    scrapeItems
      .filter((item) => failedStatuses.has(item.status))
      .map((item) => item.providerId),
  );
  const preferred = pickPreferredProviderFromItems(
    [...scrapeItems],
    activeProviderId,
  );
  const providerIds = providers.map((provider) => provider.providerId);
  const orderedIds = deprioritizeProviders(
    reorderProvidersWithPreferred(providerIds, preferred),
    failed,
  );

  return orderedIds.map(
    (providerId) =>
      providers.find((provider) => provider.providerId === providerId)!,
  );
}

export function mergeScrapeProviderMenu(
  providers: readonly ScrapeProviderOption[],
  scrapeItems: readonly ScrapeItem[],
  activeProviderId?: string | null,
): ScrapeProviderMenuEntry[] {
  const itemById = new Map(
    scrapeItems.map((item) => [item.providerId, item] as const),
  );

  return sortScrapeProvidersForMenu(
    providers,
    scrapeItems,
    activeProviderId,
  ).map((provider) => {
    const item = itemById.get(provider.providerId);
    return {
      ...provider,
      status: item?.status ?? "idle",
      error: item?.error,
    };
  });
}
