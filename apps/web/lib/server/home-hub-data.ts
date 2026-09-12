import "server-only";

import { TMDB_WATCH_REGION } from "@/lib/constants";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { tmdb } from "@/tmdb/api";
import type { Movie, TvShow } from "@/tmdb/models";
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

export type HomeMovieItem = Movie & { media_type: "movie" };
export type HomeTvItem = TvShow & { media_type: "tv" };

export const getHomeTrendingMovies = cache(
  async (): Promise<HomeMovieItem[]> => {
    const { movie: baseMovieDiscover } = getDiscoverBases();
    const { results: moviesRaw } = await tmdb.discover.movie({
      ...baseMovieDiscover,
      page: "1",
      sort_by: "popularity.desc",
    });

    return filterReleasedMovies(moviesRaw).map((movie) => ({
      ...movie,
      media_type: "movie" as const,
    }));
  },
);

export const getHomePopularMovies = cache(
  async (): Promise<HomeMovieItem[]> => {
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
      .map((movie) => ({
        ...movie,
        media_type: "movie" as const,
      }));
  },
);

export const getHomeTrendingTv = cache(async (): Promise<HomeTvItem[]> => {
  const { tv: baseTvDiscover } = getDiscoverBases();
  const { results: tvShowsRaw } = await tmdb.discover.tv({
    ...baseTvDiscover,
    page: "1",
    sort_by: "popularity.desc",
  });

  return filterReleasedTvShows(tvShowsRaw).map((show) => ({
    ...show,
    media_type: "tv" as const,
  }));
});

export const getHomePopularTv = cache(async (): Promise<HomeTvItem[]> => {
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
    .map((show) => ({
      ...show,
      media_type: "tv" as const,
    }));
});

export type HomeHubCard = HomeMovieItem | HomeTvItem;

export type HomeHubData = {
  trendingMovies: HomeMovieItem[];
  popularMovies: HomeMovieItem[];
  trendingTv: HomeTvItem[];
  popularTv: HomeTvItem[];
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
