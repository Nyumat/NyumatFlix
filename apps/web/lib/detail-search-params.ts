import { headers } from "next/headers";

/** Search params injected by middleware as `x-search-params` (avoids `searchParams` in layouts). */
export async function getDetailRouteSearchParams(): Promise<URLSearchParams> {
  return new URLSearchParams((await headers()).get("x-search-params") ?? "");
}
