import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { MovieHero } from "@/components/movie/movie-server";
import { TrendCarousel } from "@/components/trend/trend-client";
import { TrendingSpotlight } from "@/components/trend/trending-spotlight";
import { TvHero } from "@/components/tv/tv-server";
import { pages } from "@/config/pages";
import { tmdb } from "@/tmdb/api";

export async function TrendingMoviesSection() {
  const { results: moviesRaw } = await tmdb.trending.movie({
    time: "day",
    page: "1",
  });
  const movies = filterReleasedMovies(moviesRaw);
  const featured = movies.find((m) => Boolean(m.poster_path)) ?? movies[0];

  if (!featured) {
    return null;
  }

  return (
    <ContentReveal className="space-y-10">
      <TrendingSpotlight mediaType="movie" id={featured.id} priority />

      <TrendCarousel
        type="movie"
        title={pages.trending.movie.title}
        link={pages.trending.movie.link}
        items={movies}
        bleed
      />

      <div className="grid gap-4 md:grid-cols-2 xl:gap-6">
        <MovieHero
          movies={movies}
          label="Trending now"
          count={2}
          itemClassName="h-index-feature"
        />
      </div>
    </ContentReveal>
  );
}

export async function TrendingTvSection() {
  const { results: tvShowsRaw } = await tmdb.trending.tv({
    time: "day",
    page: "1",
  });
  const tvShows = filterReleasedTvShows(tvShowsRaw);
  const featured =
    tvShows.find((show) => Boolean(show.poster_path)) ?? tvShows[0];

  if (!featured) {
    return null;
  }

  return (
    <ContentReveal className="space-y-10">
      <TrendingSpotlight mediaType="tv" id={featured.id} priority />

      <TrendCarousel
        type="tv"
        title={pages.trending.tv.title}
        link={pages.trending.tv.link}
        items={tvShows}
        bleed
      />

      <div className="grid gap-4 md:grid-cols-2 xl:gap-6">
        <TvHero
          tvShows={tvShows}
          label="Trending now"
          count={2}
          itemClassName="h-index-feature"
        />
      </div>
    </ContentReveal>
  );
}

export async function TrendingPeopleSection() {
  const { results: people } = await tmdb.trending.people({
    time: "day",
    page: "1",
  });

  return (
    <ContentReveal>
      <TrendCarousel
        type="person"
        title={pages.trending.people.title}
        link={pages.trending.people.link}
        items={people ?? []}
        bleed
      />
    </ContentReveal>
  );
}
