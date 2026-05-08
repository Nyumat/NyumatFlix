import { enrichAboveFoldMediaItemsWithLogos } from "@/app/actions";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { TrendCarousel, TrendingSpotlight } from "@/components/trend";
import { MovieHero } from "@/components/movie";
import { TvHero } from "@/components/tv";
import { pages } from "@/config/pages";
import { siteConfig } from "@/config/site";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { tmdb } from "@/tmdb/api";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 3600;
const ABOVE_FOLD_LOGO_COUNT = 8;

export const metadata: Metadata = {
  title: "Trending | NyumatFlix",
  description: siteConfig.description,
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com/trending",
    title: "Trending | NyumatFlix",
    description: siteConfig.description,
    images: [{ url: "https://nyumatflix.com/og.webp", alt: "NyumatFlix" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
    title: "Trending | NyumatFlix",
    description: siteConfig.description,
    images: ["https://nyumatflix.com/og.webp"],
  },
};

export default async function TrendingHub() {
  const [{ results: moviesRaw }, { results: tvShowsRaw }, { results: people }] =
    await Promise.all([
      tmdb.trending.movie({ time: "day", page: "1" }),
      tmdb.trending.tv({ time: "day", page: "1" }),
      tmdb.trending.people({ time: "day", page: "1" }),
    ]);

  const movies = filterReleasedMovies(moviesRaw);
  const tvShows = filterReleasedTvShows(tvShowsRaw);

  const [moviesForTrendCarousel, tvShowsForTrendCarousel] = await Promise.all([
    enrichAboveFoldMediaItemsWithLogos(movies, "movie", ABOVE_FOLD_LOGO_COUNT),
    enrichAboveFoldMediaItemsWithLogos(tvShows, "tv", ABOVE_FOLD_LOGO_COUNT),
  ]);

  const featured = movies.find((m) => Boolean(m.poster_path)) ?? movies[0];

  if (!featured) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <section className="min-h-screen w-full pb-16 pt-6">
          <div className="container space-y-10">
            <header className="space-y-1 text-center md:text-left">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Trending
              </h1>
            </header>

            <TrendingSpotlight movieId={featured.id} priority />

            <TrendCarousel
              type="movie"
              title={pages.trending.movie.title}
              link={pages.trending.movie.link}
              items={moviesForTrendCarousel}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <MovieHero movies={movies} label="Trending now" count={2} />
            </div>

            <TrendCarousel
              type="tv"
              title={pages.trending.tv.title}
              link={pages.trending.tv.link}
              items={tvShowsForTrendCarousel}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TvHero tvShows={tvShows} label="Trending now" count={2} />
            </div>

            <TrendCarousel
              type="person"
              title={pages.trending.people.title}
              link={pages.trending.people.link}
              items={people}
            />
          </div>
        </section>
      </ContentContainer>
    </div>
  );
}
