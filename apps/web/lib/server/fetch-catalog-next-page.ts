import "server-only";

import { buildCatalogDiscoverUrlMerge } from "@/lib/discover-merge";
import { mapMediaListToCanonicalCardsValue } from "@/lib/cards/mappers";
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
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { filterDiscoverParams, getUserTimezone } from "@/lib/utils";
import { enrichLocalizedCatalogBackdrops } from "@/lib/server/enrich-catalog-backdrops";
import { tmdb } from "@/tmdb/api";
import type { SortByTypeMovie, SortByTypeTv } from "@/tmdb/api";
import type { CanonicalMediaCard } from "@/lib/domain/typings";

const toSearchParams = (queryParams: Record<string, string>) => {
  const sp: Record<string, string> = { ...queryParams };
  return sp;
};

const toLocalizedPage = async (
  results: CanonicalMediaCard[],
  page: number,
): Promise<{ results: CanonicalMediaCard[]; page: number }> => ({
  results: await enrichLocalizedCatalogBackdrops(results),
  page,
});

export async function fetchCatalogNextPage(
  mediaType: "movie" | "tv",
  queryParams: Record<string, string>,
  page: number,
): Promise<{ results: CanonicalMediaCard[]; page: number }> {
  const region = TMDB_WATCH_REGION;
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
      return toLocalizedPage(
        mapMediaListToCanonicalCardsValue(
          filterReleasedMovies(data.results),
          "movie",
        ),
        data.page,
      );
    }

    if (view === "trending") {
      const time = parseTrendingTime(sp.trending_time);
      const data = await tmdb.trending.movie({ time, page: pageStr });
      return toLocalizedPage(
        mapMediaListToCanonicalCardsValue(
          filterReleasedMovies(data.results),
          "movie",
        ),
        data.page,
      );
    }

    const data = await tmdb.movie.list({
      region,
      list: view,
      page: pageStr,
    });
    return toLocalizedPage(
      mapMediaListToCanonicalCardsValue(
        filterReleasedMovies(data.results),
        "movie",
      ),
      data.page,
    );
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
    return toLocalizedPage(
      mapMediaListToCanonicalCardsValue(
        filterReleasedTvShows(data.results),
        "tv",
      ),
      data.page,
    );
  }

  if (view === "trending") {
    const time = parseTrendingTime(sp.trending_time);
    const data = await tmdb.trending.tv({ time, page: pageStr });
    return toLocalizedPage(
      mapMediaListToCanonicalCardsValue(
        filterReleasedTvShows(data.results),
        "tv",
      ),
      data.page,
    );
  }

  const data = await tmdb.tv.list({
    region,
    list: view,
    page: pageStr,
    timezone,
  });
  return toLocalizedPage(
    mapMediaListToCanonicalCardsValue(
      filterReleasedTvShows(data.results),
      "tv",
    ),
    data.page,
  );
}
