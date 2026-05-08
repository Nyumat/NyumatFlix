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

export default async function Home() {
  const { results: moviesRaw } = await tmdb.trending.movie({
    time: "day",
    page: "1",
  });
  const movies = filterReleasedMovies(moviesRaw);

  const { results: popularMoviesRaw } = await tmdb.movie.list({
    list: "popular",
    page: "1",
    region: TMDB_WATCH_REGION,
  });
  const popularMovies = filterReleasedMovies(popularMoviesRaw).filter(
    (pm) => !movies.some((m) => m.id === pm.id),
  );

  const { results: tvShowsRaw } = await tmdb.trending.tv({
    time: "day",
    page: "1",
  });
  const tvShows = filterReleasedTvShows(tvShowsRaw);

  const { results: popularTvRaw } = await tmdb.tv.list({
    list: "popular",
    page: "1",
    region: TMDB_WATCH_REGION,
  });
  const popularTv = filterReleasedTvShows(popularTvRaw).filter(
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
        .slice(2)
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
      popularTv.slice(2).map((s) => ({ ...s, media_type: "tv" as const })),
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
