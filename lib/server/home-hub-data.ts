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
    const [trendingMovies, popularMoviePages] = await Promise.all([
      getHomeTrendingMovies(),
      Promise.all(
        ["1", "2", "3", "4"].map((page) =>
          tmdb.discover.movie({
            ...baseMovieDiscover,
            page,
            sort_by: "vote_count.desc",
          }),
        ),
      ),
    ]);

    const popularMoviesRaw = popularMoviePages.flatMap(
      (response) => response.results ?? [],
    );
    const popularMoviesDeduped = dedupeById(
      filterReleasedMovies(popularMoviesRaw),
    );

    return popularMoviesDeduped
      .filter((pm) => !trendingMovies.some((m) => m.id === pm.id))
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
  const [trendingTv, popularTvPages] = await Promise.all([
    getHomeTrendingTv(),
    Promise.all(
      ["1", "2", "3", "4"].map((page) =>
        tmdb.discover.tv({
          ...baseTvDiscover,
          page,
          sort_by: "vote_count.desc",
        }),
      ),
    ),
  ]);

  const popularTvRaw = popularTvPages.flatMap(
    (response) => response.results ?? [],
  );
  const popularTvDeduped = dedupeById(filterReleasedTvShows(popularTvRaw));

  return popularTvDeduped
    .filter((pt) => !trendingTv.some((t) => t.id === pt.id))
    .map((show) => ({
      ...show,
      media_type: "tv" as const,
    }));
});
