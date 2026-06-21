import { CollectionShowcase } from "@/components/collections/collection-showcase";
import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import { MovieHero } from "@/components/movie/movie-server";
import { TrendCarousel } from "@/components/trend/trend-client";
import { TvHero } from "@/components/tv/tv-server";
import { pages } from "@/config/pages";
import { enrichAboveFoldMediaItemsWithLogos } from "@/lib/server/actions";
import { getHomeCollections } from "@/lib/server/home-collections-data";
import {
  getHomePopularMovies,
  getHomePopularTv,
  getHomeTrendingMovies,
  getHomeTrendingTv,
} from "@/lib/server/home-hub-data";

const ABOVE_FOLD_LOGO_COUNT = 8;

export async function HomeFeaturedMovie() {
  const movies = await getHomeTrendingMovies();

  return (
    <ContentReveal>
      <MovieHero
        movies={movies.slice(0, 1)}
        label="Trending now"
        priority
        pick="first"
        hideGenre
      />
    </ContentReveal>
  );
}

export async function HomeTrendingMoviesCarousel() {
  const movies = await getHomeTrendingMovies();
  const items = await enrichAboveFoldMediaItemsWithLogos(
    movies.slice(3),
    "movie",
    ABOVE_FOLD_LOGO_COUNT,
  );

  return (
    <ContentReveal>
      <TrendCarousel
        type="movie"
        title="Trending Movies"
        link={pages.trending.movie.link}
        items={items}
      />
    </ContentReveal>
  );
}

export async function HomeTrendingMovieHeroes() {
  const movies = await getHomeTrendingMovies();

  return (
    <ContentReveal>
      <div className="grid gap-4 md:grid-cols-2">
        <MovieHero
          movies={movies.slice(1, 3)}
          label="Trending now"
          count={2}
          pick="first"
          hideGenre
        />
      </div>
    </ContentReveal>
  );
}

const toCollectionMediaItems = (
  parts: Awaited<ReturnType<typeof getHomeCollections>>[number]["parts"],
) =>
  parts.map((part) => ({
    ...part,
    media_type: "movie" as const,
  }));

export async function HomeCollectionsSection() {
  const collections = await getHomeCollections();
  if (!collections.length) return null;

  return (
    <ContentReveal>
      <section className="space-y-6 md:space-y-8">
        <div className="space-y-1 px-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Collections
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {collections.map((collection, index) => (
            <CollectionShowcase
              key={collection.id}
              collection={collection}
              items={toCollectionMediaItems(collection.parts)}
              priority={index === 0}
            />
          ))}
        </div>
      </section>
    </ContentReveal>
  );
}

export async function HomePopularMoviesCarousel() {
  const popularMovies = await getHomePopularMovies();
  const items = await enrichAboveFoldMediaItemsWithLogos(
    popularMovies.slice(2, 22),
    "movie",
    ABOVE_FOLD_LOGO_COUNT,
  );

  return (
    <ContentReveal>
      <TrendCarousel
        type="movie"
        title="Popular Movies"
        link={pages.movie.popular.link}
        items={items}
      />
    </ContentReveal>
  );
}

export async function HomeTrendingTvHeroes() {
  const tvShows = await getHomeTrendingTv();

  return (
    <ContentReveal>
      <div className="grid gap-4 md:grid-cols-2">
        <TvHero
          tvShows={tvShows.slice(0, 2)}
          label="Trending now"
          count={2}
          pick="first"
          hideGenre
        />
      </div>
    </ContentReveal>
  );
}

export async function HomeTrendingTvCarousel() {
  const tvShows = await getHomeTrendingTv();
  const items = await enrichAboveFoldMediaItemsWithLogos(
    tvShows.slice(2),
    "tv",
    ABOVE_FOLD_LOGO_COUNT,
  );

  return (
    <ContentReveal>
      <TrendCarousel
        type="tv"
        title="Trending TV"
        link={pages.trending.tv.link}
        items={items}
      />
    </ContentReveal>
  );
}

export async function HomePopularMovieHeroes() {
  const popularMovies = await getHomePopularMovies();

  return (
    <ContentReveal>
      <div className="grid gap-4 md:grid-cols-2">
        <MovieHero
          movies={popularMovies.slice(0, 2)}
          label="Popular now"
          count={2}
          pick="first"
          hideGenre
        />
      </div>
    </ContentReveal>
  );
}

export async function HomePopularTvCarousel() {
  const popularTv = await getHomePopularTv();
  const items = await enrichAboveFoldMediaItemsWithLogos(
    popularTv.slice(2, 22),
    "tv",
    ABOVE_FOLD_LOGO_COUNT,
  );

  return (
    <ContentReveal>
      <TrendCarousel
        type="tv"
        title="Popular TV"
        link={pages.tv.popular.link}
        items={items}
      />
    </ContentReveal>
  );
}

export async function HomePopularTvHeroes() {
  const popularTv = await getHomePopularTv();

  return (
    <ContentReveal>
      <div className="grid gap-4 md:grid-cols-2">
        <TvHero
          tvShows={popularTv.slice(0, 2)}
          label="Popular now"
          count={2}
          pick="first"
          hideGenre
        />
      </div>
    </ContentReveal>
  );
}
