"use server";

import { buildCatalogDiscoverUrlMerge } from "@/lib/discover-merge";
import {
  parseMovieView,
  parseTvView,
  parseTrendingTime,
} from "@/lib/catalog-query";
import {
  clampDiscoverMovieLte,
  clampDiscoverTvLte,
  filterReleasedMovies,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { filterDiscoverParams, getUserTimezone } from "@/lib/utils";
import { tmdb } from "@/tmdb/api";
import type { SortByTypeMovie, SortByTypeTv } from "@/tmdb/api";
import type { MediaItem } from "@/utils/typings";
import { cookies } from "next/headers";

const toSearchParams = (queryParams: Record<string, string>) => {
  const sp: Record<string, string> = { ...queryParams };
  return sp;
};

export const fetchCatalogNextPage = async (
  mediaType: "movie" | "tv",
  queryParams: Record<string, string>,
  page: number,
): Promise<{ results: MediaItem[]; page: number }> => {
  const cookieStore = await cookies();
  const region = cookieStore.get("region")?.value ?? "US";
  const sp = toSearchParams(queryParams);
  const pageStr = String(page);

  if (mediaType === "movie") {
    const view = parseMovieView(sp.view);

    if (view === "discover") {
      const today = getTodayIsoDateUtc();
      const discoverParams = filterDiscoverParams(sp);
      const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "movie");
      const mergedDiscover = { ...discoverParams, ...catalogUrlMerge };
      const data = await tmdb.discover.movie({
        watch_region: region,
        page: pageStr,
        sort_by:
          (sp.sort_by as SortByTypeMovie | undefined) ?? "popularity.desc",
        ...mergedDiscover,
        "primary_release_date.lte": clampDiscoverMovieLte(
          mergedDiscover["primary_release_date.lte"],
          today,
        ),
      });
      return {
        results: filterReleasedMovies(data.results).map((m) => ({
          ...m,
          media_type: "movie" as const,
        })),
        page: data.page,
      };
    }

    if (view === "trending") {
      const time = parseTrendingTime(sp.trending_time);
      const data = await tmdb.trending.movie({ time, page: pageStr });
      return {
        results: filterReleasedMovies(data.results).map((m) => ({
          ...m,
          media_type: "movie" as const,
        })),
        page: data.page,
      };
    }

    const data = await tmdb.movie.list({
      region,
      list: view,
      page: pageStr,
    });
    return {
      results: filterReleasedMovies(data.results).map((m) => ({
        ...m,
        media_type: "movie" as const,
      })),
      page: data.page,
    };
  }

  const view = parseTvView(sp.view);
  const timezone = getUserTimezone();

  if (view === "discover") {
    const today = getTodayIsoDateUtc();
    const discoverParams = filterDiscoverParams(sp);
    const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "tv");
    const mergedDiscover = { ...discoverParams, ...catalogUrlMerge };
    const data = await tmdb.discover.tv({
      watch_region: region,
      page: pageStr,
      sort_by: (sp.sort_by as SortByTypeTv | undefined) ?? "popularity.desc",
      ...mergedDiscover,
      "first_air_date.lte": clampDiscoverTvLte(
        mergedDiscover["first_air_date.lte"],
        today,
      ),
    });
    return {
      results: filterReleasedTvShows(data.results).map((s) => ({
        ...s,
        media_type: "tv" as const,
      })),
      page: data.page,
    };
  }

  if (view === "trending") {
    const time = parseTrendingTime(sp.trending_time);
    const data = await tmdb.trending.tv({ time, page: pageStr });
    return {
      results: filterReleasedTvShows(data.results).map((s) => ({
        ...s,
        media_type: "tv" as const,
      })),
      page: data.page,
    };
  }

  const data = await tmdb.tv.list({
    region,
    list: view,
    page: pageStr,
    timezone,
  });
  return {
    results: filterReleasedTvShows(data.results).map((s) => ({
      ...s,
      media_type: "tv" as const,
    })),
    page: data.page,
  };
};
