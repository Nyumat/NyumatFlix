"use server";

import { MediaItem } from "@/utils/typings";
import { buildMaybeItemsWithCategories, fetchTMDBData } from "../actions";

const ROW_TYPE_TO_ENDPOINT = {
  "popular-movies": "/movie/popular",
  "top-rated-movies": "/movie/top_rated",
  "action-movies": "/discover/movie?with_genres=28",
  "comedy-movies": "/discover/movie?with_genres=35",
  "drama-movies": "/discover/movie?with_genres=18",
  "thriller-movies": "/discover/movie?with_genres=53",
  "scifi-fantasy-movies": "/discover/movie?with_genres=878,14",
  "romcom-movies": "/discover/movie?with_genres=10749,35",
  "hidden-gems":
    "/discover/movie?sort_by=vote_count.asc&vote_average.gte=7.5&vote_count.gte=100&vote_count.lte=1000",
  "critically-acclaimed":
    "/discover/movie?sort_by=vote_average.desc&vote_average.gte=8&vote_count.gte=1000",
  "eighties-movies":
    "/discover/movie?primary_release_date.gte=1980-01-01&primary_release_date.lte=1989-12-31",
  "nineties-movies":
    "/discover/movie?primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31",
  "early-2000s-movies":
    "/discover/movie?primary_release_date.gte=2000-01-01&primary_release_date.lte=2009-12-31",
  "recent-releases": "/discover/movie?primary_release_date.gte=2023-01-01",

  "popular-tvshows": "/tv/popular",
  "top-rated-tvshows": "/tv/top_rated",
  "binge-worthy-series":
    "/discover/tv?sort_by=popularity.desc&with_status=0&with_type=0",
  "limited-series": "/discover/tv?with_type=2",
  "reality-tv": "/discover/tv?with_genres=10764",
  docuseries: "/discover/tv?with_genres=99",
};

/**
 * I created this to fetch more items for a specific content row on the home page.
 */
export async function getMoreHomepageItems(
  rowType: keyof typeof ROW_TYPE_TO_ENDPOINT,
  page: number = 1,
): Promise<MediaItem[]> {
  try {
    const endpoint = ROW_TYPE_TO_ENDPOINT[rowType];
    if (!endpoint) {
      console.error(`Unknown row type: ${rowType}`);
      return [];
    }

    // I'll determine the media type based on the endpoint.
    const mediaType =
      endpoint.includes("/tv/") || endpoint.includes("tv?") ? "tv" : "movie";

    // I need to add the page parameter to the endpoint.
    const separator = endpoint.includes("?") ? "&" : "?";
    const url = `${endpoint}${separator}page=${page}`;

    const data = await fetchTMDBData(url);

    if (!data || !data.results || data.results.length === 0) {
      return [];
    }

    // Now, I'll process the results and add categories.
    const itemsWithCategories = await buildMaybeItemsWithCategories<MediaItem>(
      data.results,
      mediaType,
    );

    // I'm filtering out items that don't have a poster.
    return itemsWithCategories.filter((item) => item.poster_path);
  } catch (error) {
    console.error(`Error fetching more items for ${rowType}:`, error);
    return [];
  }
}
