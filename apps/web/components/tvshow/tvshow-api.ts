import type { SeasonDetails } from "@/lib/domain/typings";
import {
  TV_DETAIL_CATALOG_ANIME,
  TV_DETAIL_CATALOG_QUERY,
  withPageTvApiPath,
  withTvApiRouteId,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";

const readSeasonDetailsResponse = async (
  path: string,
): Promise<SeasonDetails | null> => {
  const response = await fetch(path, { priority: "low" });
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    console.warn(
      `Failed to fetch season details: ${response.status} (${path})`,
    );
    return null;
  }
  return (await response.json()) as SeasonDetails;
};

export async function fetchSeasonDetailsForCatalog(
  tvId: string,
  seasonNumber: number,
  catalog: TvDetailCatalog | null,
): Promise<SeasonDetails | null> {
  try {
    const path = withTvApiRouteId(
      `/api/tv/${tvId}/season/${seasonNumber}`,
      catalog,
    );
    return await readSeasonDetailsResponse(path);
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function fetchSeasonDetails(
  tvId: string,
  seasonNumber: number,
): Promise<SeasonDetails | null> {
  try {
    const pathname =
      typeof window !== "undefined" ? (window.location?.pathname ?? "") : "";
    const path = withPageTvApiPath(
      `/api/tv/${tvId}/season/${seasonNumber}`,
      pathname,
    );
    return await readSeasonDetailsResponse(path);
  } catch (error) {
    console.error(error);
    return null;
  }
}

export { TV_DETAIL_CATALOG_ANIME, TV_DETAIL_CATALOG_QUERY };
