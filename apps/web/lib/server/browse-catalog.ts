import "server-only";

import {
  catalogCardsToMediaItems,
  mapReleasedItemsToCatalogCards,
  type BrowseMediaType,
  type CatalogMediaCard,
} from "@/lib/cards/catalog-dto";
import type { MediaItem } from "@/lib/domain/typings";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { fetchTMDBData } from "@/lib/server/actions";
import { enrichLocalizedCatalogBackdrops } from "@/lib/server/enrich-catalog-backdrops";

export type BrowseCatalogPage = {
  page: number;
  total_pages: number;
  total_results?: number;
  results: CatalogMediaCard[];
};

export { catalogCardsToMediaItems };

const filterReleased = (
  items: MediaItem[],
  mediaType: BrowseMediaType,
): MediaItem[] =>
  (mediaType === "movie"
    ? filterReleasedMovies(items)
    : filterReleasedTvShows(items)) as MediaItem[];

const withPoster = <T extends { poster_path?: string | null }>(
  items: T[],
): T[] => items.filter((item) => Boolean(item.poster_path));

const fetchBrowsePage = async (
  mediaType: BrowseMediaType,
  page: number,
  queryParams: Record<string, string>,
): Promise<BrowseCatalogPage> => {
  const data = await fetchTMDBData<MediaItem>(
    `/discover/${mediaType}`,
    queryParams,
    page,
  );

  const released = filterReleased(withPoster(data.results ?? []), mediaType);
  const cards = mapReleasedItemsToCatalogCards(
    released as Array<{
      id: number;
      title?: string;
      name?: string;
      poster_path: string;
      backdrop_path?: string | null;
      release_date?: string;
      first_air_date?: string;
      vote_average?: number;
      vote_count?: number;
    }>,
    mediaType,
  );

  return {
    page: data.page ?? page,
    total_pages: data.total_pages ?? 1,
    total_results: data.total_results,
    results: await enrichLocalizedCatalogBackdrops(cards),
  };
};

export async function fetchCountryBrowsePage(
  countryCode: string,
  mediaType: BrowseMediaType,
  page = 1,
  sortBy = "vote_average.desc",
): Promise<BrowseCatalogPage> {
  const today = getTodayIsoDateUtc();
  const queryParams: Record<string, string> = {
    language: "en-US",
    include_adult: "false",
    sort_by: sortBy,
    "vote_count.gte": "10",
  };

  if (mediaType === "movie") {
    queryParams.region = countryCode;
    queryParams["primary_release_date.lte"] = today;
    if (countryCode === "US") {
      queryParams.with_origin_country = "US";
    }
  } else {
    queryParams.with_origin_country = countryCode;
    queryParams["first_air_date.lte"] = today;
  }

  if (sortBy.startsWith("vote_average.")) {
    queryParams["vote_average.gte"] = "6.0";
  }

  return fetchBrowsePage(mediaType, page, queryParams);
}

export async function fetchGenreBrowsePage(
  genreId: string,
  mediaType: BrowseMediaType,
  page = 1,
  sortBy = "vote_average.desc",
): Promise<BrowseCatalogPage> {
  const today = getTodayIsoDateUtc();
  const queryParams: Record<string, string> = {
    language: "en-US",
    include_adult: "false",
    sort_by: sortBy,
    "vote_count.gte": "10",
    with_genres: genreId,
    [mediaType === "movie" ? "primary_release_date.lte" : "first_air_date.lte"]:
      today,
  };

  if (sortBy.startsWith("vote_average.")) {
    queryParams["vote_average.gte"] = "6.0";
  }

  return fetchBrowsePage(mediaType, page, queryParams);
}
