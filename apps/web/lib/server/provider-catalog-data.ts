import { slimMediaItemsForRsc } from "@/lib/cards/catalog-dto";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import type { MediaItem } from "@/lib/domain/typings";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import {
  getProviderDiscoverQueryParams,
  type WatchProviderBrand,
} from "@/lib/watch-providers";
import { tmdb } from "@/tmdb/api";

export type ProviderMediaType = "movie" | "tv";

export type ProviderCatalogData = {
  items: MediaItem[];
  currentPage: number;
  totalPages: number;
};

export async function getProviderCatalog(
  provider: WatchProviderBrand,
  mediaType: ProviderMediaType,
): Promise<ProviderCatalogData> {
  const discoverParams = getProviderDiscoverQueryParams(provider);
  const today = getTodayIsoDateUtc();

  if (mediaType === "movie") {
    const response = await tmdb.discover.movie({
      watch_region: TMDB_WATCH_REGION,
      ...discoverParams,
      page: "1",
      sort_by: "popularity.desc",
      "primary_release_date.lte": today,
    });
    const movies = filterReleasedMovies(response.results ?? []);

    return {
      items: slimMediaItemsForRsc(
        movies.map((movie) => ({ ...movie, media_type: "movie" as const })),
      ),
      currentPage: response.page,
      totalPages: response.total_pages,
    };
  }

  const response = await tmdb.discover.tv({
    watch_region: TMDB_WATCH_REGION,
    ...discoverParams,
    page: "1",
    sort_by: "popularity.desc",
    "first_air_date.lte": today,
  });
  const shows = filterReleasedTvShows(response.results ?? []);

  return {
    items: slimMediaItemsForRsc(
      shows.map((show) => ({ ...show, media_type: "tv" as const })),
    ),
    currentPage: response.page,
    totalPages: response.total_pages,
  };
}
