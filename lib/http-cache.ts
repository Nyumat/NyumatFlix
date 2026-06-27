export const CACHE_REVALIDATE_SECONDS = 3600;
export const CACHE_SEASON_REVALIDATE_SECONDS = 900;

export const CACHE_CONTROL_CATALOG =
  "public, s-maxage=3600, stale-while-revalidate=86400";

export const CACHE_CONTROL_SEASON =
  "public, s-maxage=900, stale-while-revalidate=3600";

export const catalogCacheHeaders = (): HeadersInit => ({
  "Cache-Control": CACHE_CONTROL_CATALOG,
});

export const seasonCacheHeaders = (): HeadersInit => ({
  "Cache-Control": CACHE_CONTROL_SEASON,
});

export const CACHE_CONTROL_SIGNED_URL =
  "private, no-store, max-age=0, must-revalidate";

export const signedUrlCacheHeaders = (): HeadersInit => ({
  "Cache-Control": CACHE_CONTROL_SIGNED_URL,
});
