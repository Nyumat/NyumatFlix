import type { MediaItem } from "@/lib/domain/typings";
import {
  providerPopularCacheKey,
  type ProviderPopularCacheKey,
  type ProviderPopularMediaKind,
} from "@/lib/provider-popular-shared";

export type { ProviderPopularCacheKey };
export { providerPopularCacheKey };

type CatalogMediaKind = ProviderPopularMediaKind;

const memoryCache = new Map<ProviderPopularCacheKey, MediaItem[]>();

export const readProviderPopularCache = (
  key: ProviderPopularCacheKey,
): MediaItem[] | undefined => memoryCache.get(key);

export const writeProviderPopularCache = (
  key: ProviderPopularCacheKey,
  items: MediaItem[],
) => {
  memoryCache.set(key, items);
};

type ProviderPopularResponse = {
  items?: MediaItem[];
};

export const fetchProviderPopularItems = async (
  providerId: string,
  mediaKind: CatalogMediaKind,
  signal?: AbortSignal,
): Promise<MediaItem[]> => {
  const key = providerPopularCacheKey(providerId, mediaKind);
  const cached = memoryCache.get(key);
  if (cached) {
    return cached;
  }

  const pageKey = mediaKind === "movie" ? "movies" : "tv";
  const params = new URLSearchParams({
    pageKey,
    providerId,
    scope: "popular",
  });

  const response = await fetch(`/api/catalog/provider-showcase?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as ProviderPopularResponse;
  const items = Array.isArray(payload.items) ? payload.items : [];
  memoryCache.set(key, items);
  return items;
};
