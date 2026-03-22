import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { TrendCarousel } from "@/components/trend";
import { MovieHero } from "@/components/movie";
import { TvHero } from "@/components/tv";
import { pages } from "@/config/pages";
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

  const { results: movies } = await tmdb.trending.movie({
    time: "day",
    page: "1",
  });

  const { results: popularMovies } = await tmdb.movie.list({
    list: "popular",
    page: "1",
    region,
  });

  const { results: tvShows } = await tmdb.trending.tv({
    time: "day",
    page: "1",
  });

  const { results: popularTv } = await tmdb.tv.list({
    list: "popular",
    page: "1",
    region,
  });

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
              items={movies}
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
              items={popularMovies.map((movie) => ({
                ...movie,
                media_type: "movie" as const,
              }))}
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
              items={tvShows}
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
              items={popularTv.map((tv) => ({
                ...tv,
                media_type: "tv" as const,
              }))}
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
