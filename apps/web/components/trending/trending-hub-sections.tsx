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
import { prepareCatalogRowItemsForRsc } from "@/lib/server/prepare-catalog-row-items";
import {
  buildCatalogHubFeature,
  toMovieHubBackdrop,
} from "@/lib/server/catalog-hub-feature";
import type { Movie, TvShow } from "@/tmdb/models";
import { tmdb } from "@/tmdb/api";
import { cache } from "react";

const toMediaItems = async <T extends Movie | TvShow>(
  items: T[],
  mediaType: "movie" | "tv",
) =>
  (await prepareCatalogRowItemsForRsc(
    items.map((item) => ({ ...item, media_type: mediaType })),
  )) as unknown as MediaItem[];

const getCachedTrendingMoviesDay = cache(async () => {
  const { results } = await tmdb.trending.movie({ time: "day", page: "1" });
  return filterReleasedMovies(results ?? []);
});

export const getTrendingHubFeature = cache(async () => {
  const movies = await getCachedTrendingMoviesDay();

  return buildCatalogHubFeature({
    candidates: movies,
    mediaType: "movie",
    pick: (items) => items.find((item) => item.backdrop_path) ?? items[0],
    toBackdrop: toMovieHubBackdrop,
  });
});

export async function getTrendingHubAmbientBackdrop() {
  return (await getTrendingHubFeature())?.backdrop ?? null;
}

export async function TrendingFeatureHero() {
  const feature = await getTrendingHubFeature();

  if (!feature?.item) return null;

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
  const movies = await getCachedTrendingMoviesDay();
  if (movies.length === 0) {
    return null;
  }

  return (
    <ContentReveal className="space-y-10">
      <ContentRow
        title={pages.trending.movie.title}
        href={pages.trending.movie.link}
        items={await toMediaItems(movies, "movie")}
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
        items={await toMediaItems(tvShows, "tv")}
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
