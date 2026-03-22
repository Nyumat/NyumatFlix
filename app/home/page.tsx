import { enrichMediaItemsWithLogos } from "@/app/actions";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { TrendCarousel } from "@/components/trend";
import { MovieHero } from "@/components/movie";
import { TvHero } from "@/components/tv";
import { pages } from "@/config/pages";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { getCountryName } from "@/lib/utils";
import { tmdb } from "@/tmdb/api";
import { cookies } from "next/headers";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Home | NyumatFlix",
  description: pages.home.description,
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com/home",
    title: "Home | NyumatFlix",
    description: pages.home.description,
    images: [{ url: "https://nyumatflix.com/og.webp", alt: "NyumatFlix" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
    title: "Home | NyumatFlix",
    description: pages.home.description,
    images: ["https://nyumatflix.com/og.webp"],
  },
};

export default async function Home() {
  const cookieStore = await cookies();
  const region = cookieStore.get("region")?.value ?? "US";
  const countryLabel = getCountryName(region);

  const { results: moviesRaw } = await tmdb.trending.movie({
    time: "day",
    page: "1",
  });
  const movies = filterReleasedMovies(moviesRaw);

  const { results: popularMoviesRaw } = await tmdb.movie.list({
    list: "popular",
    page: "1",
    region,
  });
  const popularMovies = filterReleasedMovies(popularMoviesRaw);

  const { results: tvShowsRaw } = await tmdb.trending.tv({
    time: "day",
    page: "1",
  });
  const tvShows = filterReleasedTvShows(tvShowsRaw);

  const { results: popularTvRaw } = await tmdb.tv.list({
    list: "popular",
    page: "1",
    region,
  });
  const popularTv = filterReleasedTvShows(popularTvRaw);

  const [
    moviesForTrendCarousel,
    popularMoviesForTrendCarousel,
    tvShowsForTrendCarousel,
    popularTvForTrendCarousel,
  ] = await Promise.all([
    enrichMediaItemsWithLogos(movies, "movie"),
    enrichMediaItemsWithLogos(
      popularMovies.map((m) => ({ ...m, media_type: "movie" as const })),
      "movie",
    ),
    enrichMediaItemsWithLogos(tvShows, "tv"),
    enrichMediaItemsWithLogos(
      popularTv.map((s) => ({ ...s, media_type: "tv" as const })),
      "tv",
    ),
  ]);

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <section className="min-h-screen w-full pb-16 pt-6">
          <div className="container space-y-10">
            <MovieHero movies={movies} label="Trending now" priority />

            <TrendCarousel
              type="movie"
              title="Trending movies"
              description={pages.trending.movie.description}
              link={pages.trending.movie.link}
              items={moviesForTrendCarousel}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <MovieHero
                movies={movies.slice(0, 10)}
                label="Trending now"
                count={2}
              />
            </div>

            <TrendCarousel
              type="movie"
              title={`Popular movies in ${countryLabel}`}
              description={pages.movie.popular.description}
              link={pages.movie.popular.link}
              items={popularMoviesForTrendCarousel}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TvHero
                tvShows={tvShows.slice(0, 10)}
                label="Trending now"
                count={2}
              />
            </div>

            <TrendCarousel
              type="tv"
              title="Trending TV shows"
              description={pages.trending.tv.description}
              link={pages.trending.tv.link}
              items={tvShowsForTrendCarousel}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <MovieHero
                movies={movies.slice(10, 20)}
                label="Trending now"
                count={2}
              />
            </div>

            <TrendCarousel
              type="tv"
              title={`Popular TV in ${countryLabel}`}
              description={pages.tv.popular.description}
              link={pages.tv.popular.link}
              items={popularTvForTrendCarousel}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TvHero
                tvShows={tvShows.slice(10, 20)}
                label="Trending now"
                count={2}
              />
            </div>
          </div>
        </section>
      </ContentContainer>
    </div>
  );
}
