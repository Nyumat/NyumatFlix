import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import { enrichAboveFoldMediaItemsWithLogos } from "@/lib/server/actions";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { CAROUSEL_LOGO_ENRICH_COUNT } from "@/lib/tmdb-logo";
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

  const moviesForTrendCarousel = await enrichAboveFoldMediaItemsWithLogos(
    movies,
    "movie",
    CAROUSEL_LOGO_ENRICH_COUNT,
  );

  return (
    <ContentReveal className="space-y-10">
      <TrendingSpotlight mediaType="movie" id={featured.id} priority />

      <TrendCarousel
        type="movie"
        title={pages.trending.movie.title}
        link={pages.trending.movie.link}
        items={moviesForTrendCarousel}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <MovieHero movies={movies} label="Trending now" count={2} />
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

  const tvShowsForTrendCarousel = await enrichAboveFoldMediaItemsWithLogos(
    tvShows,
    "tv",
    CAROUSEL_LOGO_ENRICH_COUNT,
  );

  return (
    <ContentReveal className="space-y-10">
      <TrendingSpotlight mediaType="tv" id={featured.id} priority />

      <TrendCarousel
        type="tv"
        title={pages.trending.tv.title}
        link={pages.trending.tv.link}
        items={tvShowsForTrendCarousel}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TvHero tvShows={tvShows} label="Trending now" count={2} />
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
      />
    </ContentReveal>
  );
}
