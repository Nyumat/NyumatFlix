import { enrichAboveFoldMediaItemsWithLogos } from "@/app/actions";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { MovieHero } from "@/components/movie";
import { TrendCarousel } from "@/components/trend";
import { TvHero } from "@/components/tv";
import { pages } from "@/config/pages";
import { siteConfig } from "@/config/site";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { tmdb } from "@/tmdb/api";
import type { Metadata } from "next";

export const revalidate = 3600;
const ABOVE_FOLD_LOGO_COUNT = 8;

export const metadata: Metadata = {
  title: "Home | NyumatFlix",
  description: siteConfig.description,
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com/",
    title: "Home | NyumatFlix",
    description: siteConfig.description,
    images: [{ url: "https://nyumatflix.com/og.webp", alt: "NyumatFlix" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
    title: "Home | NyumatFlix",
    description: siteConfig.description,
    images: ["https://nyumatflix.com/og.webp"],
  },
};

const dedupeById = <T extends { id: number }>(items: T[]): T[] => {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export default async function Home() {
  const today = getTodayIsoDateUtc();
  const baseMovieDiscover = {
    watch_region: TMDB_WATCH_REGION,
    with_origin_country: "US",
    "primary_release_date.lte": today,
  };
  const baseTvDiscover = {
    watch_region: TMDB_WATCH_REGION,
    with_origin_country: "US",
    "first_air_date.lte": today,
  };
  const [
    { results: moviesRaw },
    popularMoviePages,
    { results: tvShowsRaw },
    popularTvPages,
  ] = await Promise.all([
    tmdb.discover.movie({
      ...baseMovieDiscover,
      page: "1",
      sort_by: "popularity.desc",
    }),
    Promise.all(
      ["1", "2", "3", "4"].map((page) =>
        tmdb.discover.movie({
          ...baseMovieDiscover,
          page,
          sort_by: "vote_count.desc",
        }),
      ),
    ),
    tmdb.discover.tv({
      ...baseTvDiscover,
      page: "1",
      sort_by: "popularity.desc",
    }),
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

  const movies = filterReleasedMovies(moviesRaw).map((movie) => ({
    ...movie,
    media_type: "movie" as const,
  }));

  const popularMoviesRaw = popularMoviePages.flatMap(
    (response) => response.results ?? [],
  );
  const popularMoviesDeduped = dedupeById(
    filterReleasedMovies(popularMoviesRaw),
  );
  const popularMovies = popularMoviesDeduped.filter(
    (pm) => !movies.some((m) => m.id === pm.id),
  );

  const tvShows = filterReleasedTvShows(tvShowsRaw).map((show) => ({
    ...show,
    media_type: "tv" as const,
  }));

  const popularTvRaw = popularTvPages.flatMap(
    (response) => response.results ?? [],
  );
  const popularTvDeduped = dedupeById(filterReleasedTvShows(popularTvRaw));
  const popularTv = popularTvDeduped.filter(
    (pt) => !tvShows.some((t) => t.id === pt.id),
  );

  const mainFeaturedMovie = movies.slice(0, 1);
  const heroMovies1 = movies.slice(1, 3);
  const heroTv1 = tvShows.slice(0, 2);
  const heroMovies2 = popularMovies.slice(0, 2);
  const heroTv2 = popularTv.slice(0, 2);

  const [
    moviesForTrendCarousel,
    popularMoviesForTrendCarousel,
    tvShowsForTrendCarousel,
    popularTvForTrendCarousel,
  ] = await Promise.all([
    enrichAboveFoldMediaItemsWithLogos(
      movies.slice(3),
      "movie",
      ABOVE_FOLD_LOGO_COUNT,
    ),
    enrichAboveFoldMediaItemsWithLogos(
      popularMovies
        .slice(2, 22)
        .map((m) => ({ ...m, media_type: "movie" as const })),
      "movie",
      ABOVE_FOLD_LOGO_COUNT,
    ),
    enrichAboveFoldMediaItemsWithLogos(
      tvShows.slice(2),
      "tv",
      ABOVE_FOLD_LOGO_COUNT,
    ),
    enrichAboveFoldMediaItemsWithLogos(
      popularTv.slice(2, 22).map((s) => ({ ...s, media_type: "tv" as const })),
      "tv",
      ABOVE_FOLD_LOGO_COUNT,
    ),
  ]);

  return (
    <PageContainer>
      <div className="flex w-full flex-col">
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

        <ContentContainer className="relative z-10 flex w-full flex-col items-center">
          <section className="min-h-screen w-full pb-16 pt-6">
            <div className="container space-y-10">
              <MovieHero
                movies={mainFeaturedMovie}
                label="Trending now"
                priority
                pick="first"
              />

              <TrendCarousel
                type="movie"
                title="Trending movies"
                link={pages.trending.movie.link}
                items={moviesForTrendCarousel}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <MovieHero
                  movies={heroMovies1}
                  label="Trending now"
                  count={2}
                  pick="first"
                />
              </div>

              <TrendCarousel
                type="movie"
                title="Popular movies"
                link={pages.movie.popular.link}
                items={popularMoviesForTrendCarousel}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <TvHero
                  tvShows={heroTv1}
                  label="Trending now"
                  count={2}
                  pick="first"
                />
              </div>

              <TrendCarousel
                type="tv"
                title="Trending TV shows"
                link={pages.trending.tv.link}
                items={tvShowsForTrendCarousel}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <MovieHero
                  movies={heroMovies2}
                  label="Popular now"
                  count={2}
                  pick="first"
                />
              </div>

              <TrendCarousel
                type="tv"
                title="Popular TV"
                link={pages.tv.popular.link}
                items={popularTvForTrendCarousel}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <TvHero
                  tvShows={heroTv2}
                  label="Popular now"
                  count={2}
                  pick="first"
                />
              </div>
            </div>
          </section>
        </ContentContainer>
      </div>
    </PageContainer>
  );
}
