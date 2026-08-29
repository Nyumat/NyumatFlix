/** Shared dev vs production cache behavior. */

export const IS_DEV = process.env.NODE_ENV === "development";

/** React Query `staleTime` — always fresh in dev. */
export function queryStaleTime(productionMs: number): number {
  return IS_DEV ? 0 : productionMs;
}

/** React Query `gcTime` — drop immediately in dev. */
export function queryGcTime(productionMs: number): number {
  return IS_DEV ? 0 : productionMs;
}

/** Next.js `fetch` `revalidate` — no ISR cache in dev. */
export function fetchRevalidateSeconds(productionSeconds: number): number {
  return IS_DEV ? 0 : productionSeconds;
}

export const DEV_CACHE_CONTROL = "no-store, no-cache, must-revalidate";
