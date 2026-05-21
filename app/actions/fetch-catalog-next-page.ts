"use server";

import type { CanonicalMediaCard } from "@/lib/domain/typings";
import { fetchCatalogNextPage as fetchCatalogNextPageImpl } from "@/lib/server/fetch-catalog-next-page";

export async function fetchCatalogNextPage(
  mediaType: "movie" | "tv",
  queryParams: Record<string, string>,
  page: number,
): Promise<{ results: CanonicalMediaCard[]; page: number }> {
  return fetchCatalogNextPageImpl(mediaType, queryParams, page);
}
