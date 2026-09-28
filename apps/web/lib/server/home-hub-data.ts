import "server-only";

import { TMDB_WATCH_REGION } from "@/lib/constants";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import {
  type CatalogMediaCard,
  type CatalogMovieCard,
  type CatalogTvCard,
  toCatalogMovieCard,
  toCatalogTvCard,
} from "@/lib/cards/catalog-dto";
import {
  getSnapshotPopularMovies,
  getSnapshotPopularTv,
  getSnapshotTop10,
  getSnapshotTrendingMovies,
  getSnapshotTrendingTv,
} from "@/lib/server/hub-snapshots";
import { tmdb } from "@/tmdb/api";
import { cache } from "react";

const dedupeById = <T extends { id: number }>(items: T[]): T[] => {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

function getDiscoverBases() {
  const today = getTodayIsoDateUtc();
  return {
    movie: {
      watch_region: TMDB_WATCH_REGION,
      with_origin_country: "US",
      "primary_release_date.lte": today,
    },
    tv: {
      watch_region: TMDB_WATCH_REGION,
      with_origin_country: "US",
      "first_air_date.lte": today,
    },
  };
}

export const getHomeTrendingMovies = cache(
  async (): Promise<CatalogMovieCard[]> => {
    const snapshot = getSnapshotTrendingMovies();
    if (snapshot) {
      return snapshot.filter((item) => item.media_type === "movie");
    }

    const { movie: baseMovieDiscover } = getDiscoverBases();
    const { results: moviesRaw } = await tmdb.discover.movie({
      ...baseMovieDiscover,
      page: "1",
      sort_by: "popularity.desc",
    });

    return filterReleasedMovies(moviesRaw).map((movie) =>
      toCatalogMovieCard({ ...movie, media_type: "movie" }),
    );
  },
);

export const getHomePopularMovies = cache(
  async (): Promise<CatalogMovieCard[]> => {
    const snapshot = getSnapshotPopularMovies();
    if (snapshot) {
      return snapshot.filter((item) => item.media_type === "movie");
    }

    const { movie: baseMovieDiscover } = getDiscoverBases();
    const [trendingMovies, popularMoviePage] = await Promise.all([
      getHomeTrendingMovies(),
      tmdb.discover.movie({
        ...baseMovieDiscover,
        page: "1",
        sort_by: "vote_count.desc",
      }),
    ]);

    const popularMoviesRaw = popularMoviePage.results ?? [];
    const popularMoviesDeduped = dedupeById(
      filterReleasedMovies(popularMoviesRaw),
    );
    const trendingMovieIds = new Set(trendingMovies.map((m) => m.id));

    return popularMoviesDeduped
      .filter((pm) => !trendingMovieIds.has(pm.id))
      .map((movie) => toCatalogMovieCard({ ...movie, media_type: "movie" }));
  },
);

export const getHomeTrendingTv = cache(async (): Promise<CatalogTvCard[]> => {
  const snapshot = getSnapshotTrendingTv();
  if (snapshot) {
    return snapshot.filter((item) => item.media_type === "tv");
  }

  const { tv: baseTvDiscover } = getDiscoverBases();
  const { results: tvShowsRaw } = await tmdb.discover.tv({
    ...baseTvDiscover,
    page: "1",
    sort_by: "popularity.desc",
  });

  return filterReleasedTvShows(tvShowsRaw).map((show) =>
    toCatalogTvCard({ ...show, media_type: "tv" }),
  );
});

export const getHomePopularTv = cache(async (): Promise<CatalogTvCard[]> => {
  const snapshot = getSnapshotPopularTv();
  if (snapshot) {
    return snapshot.filter((item) => item.media_type === "tv");
  }

  const { tv: baseTvDiscover } = getDiscoverBases();
  const [trendingTv, popularTvPage] = await Promise.all([
    getHomeTrendingTv(),
    tmdb.discover.tv({
      ...baseTvDiscover,
      page: "1",
      sort_by: "vote_count.desc",
    }),
  ]);

  const popularTvRaw = popularTvPage.results ?? [];
  const popularTvDeduped = dedupeById(filterReleasedTvShows(popularTvRaw));
  const trendingTvIds = new Set(trendingTv.map((t) => t.id));

  return popularTvDeduped
    .filter((pt) => !trendingTvIds.has(pt.id))
    .map((show) => toCatalogTvCard({ ...show, media_type: "tv" }));
});

export type HomeHubCard = CatalogMediaCard;

export const getHomeTop10Today = cache(async (): Promise<HomeHubCard[]> => {
  const snapshot = getSnapshotTop10();
  if (snapshot) {
    return snapshot;
  }

  const { results } = await tmdb.trending.all({ time: "day" });
  const results_ = results ?? [];

  return results_
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 10)
    .map((item) =>
      item.media_type === "tv"
        ? toCatalogTvCard(item)
        : toCatalogMovieCard(item),
    );
});

export type HomeHubData = {
  trendingMovies: CatalogMovieCard[];
  popularMovies: CatalogMovieCard[];
  trendingTv: CatalogTvCard[];
  popularTv: CatalogTvCard[];
};

/**
 * Single consolidated fetch for the home surface. Runs every catalog query in
 * parallel so the home renders in one pass instead of many suspense sections.
 * Each leaf query is React-cache()-deduped within the request.
 */
export const getHomeHub = cache(async (): Promise<HomeHubData> => {
  const [trendingMovies, popularMovies, trendingTv, popularTv] =
    await Promise.all([
      getHomeTrendingMovies(),
      getHomePopularMovies(),
      getHomeTrendingTv(),
      getHomePopularTv(),
    ]);

  return { trendingMovies, popularMovies, trendingTv, popularTv };
});
