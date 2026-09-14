export type ProviderPopularMediaKind = "movie" | "tv";

export type ProviderPopularCacheKey = `${string}:${ProviderPopularMediaKind}`;

export const providerPopularCacheKey = (
  providerId: string,
  mediaKind: ProviderPopularMediaKind,
): ProviderPopularCacheKey => `${providerId}:${mediaKind}`;
