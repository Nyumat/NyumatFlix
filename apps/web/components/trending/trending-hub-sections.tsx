import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { ContentRow } from "@/components/content/content-row";
import { IndexFeatureHero } from "@/components/catalog/index-feature-hero";
import { TrendCarousel } from "@/components/trend/trend-client";
import { pages } from "@/config/pages";
import type { MediaItem } from "@/lib/domain/typings";
import { slimMediaItemsForRsc } from "@/lib/cards/catalog-dto";
import {
  buildCatalogHubFeature,
  toMovieHubBackdrop,
} from "@/lib/server/catalog-hub-feature";
import type { Movie, TvShow } from "@/tmdb/models";
import { tmdb } from "@/tmdb/api";

const toMediaItems = <T extends Movie | TvShow>(
  items: T[],
  mediaType: "movie" | "tv",
) =>
  slimMediaItemsForRsc(
    items.map((item) => ({ ...item, media_type: mediaType })),
  ) as unknown as MediaItem[];

export async function TrendingFeatureHero() {
  const { results } = await tmdb.trending.movie({ time: "day", page: "1" });
  const movies = filterReleasedMovies(results);
  const feature = await buildCatalogHubFeature({
    candidates: movies,
    mediaType: "movie",
    pick: (items) => items.find((item) => item.backdrop_path) ?? items[0],
    toBackdrop: toMovieHubBackdrop,
  });

  if (!feature) return null;

  return (
    <IndexFeatureHero
      mediaType="movie"
      item={feature.item}
      items={feature.items}
      label="Trending now"
      priority
    />
  );
}

export async function TrendingMoviesSection() {
  const { results: moviesRaw } = await tmdb.trending.movie({
    time: "day",
    page: "1",
  });
  const movies = filterReleasedMovies(moviesRaw);
  if (movies.length === 0) {
    return null;
  }

  return (
    <ContentReveal className="space-y-10">
      <ContentRow
        title={pages.trending.movie.title}
        href={pages.trending.movie.link}
        items={toMediaItems(movies, "movie")}
        variant="ranked"
        bleed
      />
    </ContentReveal>
  );
}

export async function TrendingTvSection() {
  const { results: tvShowsRaw } = await tmdb.trending.tv({
    time: "day",
    page: "1",
  });
  const tvShows = filterReleasedTvShows(tvShowsRaw);
  if (tvShows.length === 0) {
    return null;
  }

  return (
    <ContentReveal className="space-y-10">
      <ContentRow
        title={pages.trending.tv.title}
        href={pages.trending.tv.link}
        items={toMediaItems(tvShows, "tv")}
        variant="ranked"
        bleed
      />
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
