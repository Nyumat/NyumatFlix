import type { SeasonDetails } from "@/lib/domain/typings";
import {
  TV_DETAIL_CATALOG_ANIME,
  TV_DETAIL_CATALOG_QUERY,
  withTvDetailCatalogQuery,
} from "@/lib/tv-detail-catalog";

export async function fetchSeasonDetails(
  tvId: string,
  seasonNumber: number,
): Promise<SeasonDetails | null> {
  try {
    const path = withTvDetailCatalogQuery(
      `/api/tv/${tvId}/season/${seasonNumber}`,
      typeof window !== "undefined" &&
        window.location.pathname.startsWith("/anime/")
        ? "anime"
        : null,
    );
    const response = await fetch(path);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.warn(
        `Failed to fetch season details: ${response.status} (${path})`,
      );
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

export { TV_DETAIL_CATALOG_ANIME, TV_DETAIL_CATALOG_QUERY };
