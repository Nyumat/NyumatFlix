/** Shared dev vs production cache behavior. */

export const IS_DEV = process.env.NODE_ENV === "development";

export const PERF_DEV_CACHE = process.env.PERF_DEV_CACHE === "1";

const useProductionLikeCache = !IS_DEV || PERF_DEV_CACHE;

/** React Query `staleTime` — always fresh in dev unless PERF_DEV_CACHE=1. */
export function queryStaleTime(productionMs: number): number {
  return useProductionLikeCache ? productionMs : 0;
}

/** React Query `gcTime` — drop immediately in dev unless PERF_DEV_CACHE=1. */
export function queryGcTime(productionMs: number): number {
  return useProductionLikeCache ? productionMs : 0;
}

/** Next.js `fetch` `revalidate` — no ISR cache in dev unless PERF_DEV_CACHE=1. */
export function fetchRevalidateSeconds(productionSeconds: number): number {
  return useProductionLikeCache ? productionSeconds : 0;
}

export const DEV_CACHE_CONTROL = "no-store, no-cache, must-revalidate";
