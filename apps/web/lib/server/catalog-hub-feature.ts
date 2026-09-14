import "server-only";

import type { IndexFeatureHeroItem } from "@/components/catalog/index-feature-hero";
import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { pickHeroBackdropPath } from "@/lib/catalog-hub-backdrop";
import {
  pickCriticallyAcclaimedHubFeatured,
  pickMostPopularHubFeatured,
} from "@/lib/catalog-hub-pick";
import type { MediaItem } from "@/lib/domain/typings";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
  getAcclaimedHubMovieReleaseDateLte,
  getRollingYearDateRangeUtc,
} from "@/lib/released-media";
import { isAnime } from "@/utils/anilist-helpers";
import { tmdb, type WithImages } from "@/tmdb/api";
import type { Image, MovieDetails, TvShowDetails } from "@/tmdb/models";
import { tmdbImage } from "@/tmdb/utils";
import { cache } from "react";

export type CatalogHubFeature = {
  item: IndexFeatureHeroItem;
  items: IndexFeatureHeroItem[];
  backdrop: PageBackdrop | null;
};

export {
  pickCriticallyAcclaimedHubFeatured,
  pickMostPopularHubFeatured,
} from "@/lib/catalog-hub-pick";

/** @deprecated Use pickMostPopularHubFeatured */
export const pickMovieHubFeatured = pickMostPopularHubFeatured;

/** @deprecated Use pickMostPopularHubFeatured */
export const pickMainstreamHubFeatured = pickMostPopularHubFeatured;

/** TMDB TV discover mixes anime; prefer live-action in the past-year pool. */
export const pickTvHubFeatured = (shows: MediaItem[]) => {
  const withBackdrop = shows.filter((show) => Boolean(show.backdrop_path));
  const liveAction = withBackdrop.filter((show) => !isAnime(show));
  const pool = liveAction.length > 0 ? liveAction : withBackdrop;

  return pickMostPopularHubFeatured(pool);
};

export const toMovieHubBackdrop = (
  item: IndexFeatureHeroItem,
): PageBackdrop | null => {
  if (!item.backdrop_path) return null;

  return {
    imageUrl: tmdbImage.backdrop(item.backdrop_path, "original"),
    alt: item.title ?? item.name ?? "Featured movie",
    priority: true,
  };
};

export const toTvHubBackdrop = (
  item: IndexFeatureHeroItem,
): PageBackdrop | null => {
  if (!item.backdrop_path) return null;

  return {
    imageUrl: tmdbImage.backdrop(item.backdrop_path, "original"),
    alt: item.name ?? item.title ?? "Featured TV series",
    priority: true,
  };
};

const selectLogo = (logos: Image[] | undefined) =>
  logos?.find((logo) => logo.iso_639_1 === "en") ?? logos?.[0];

const mapMovieHubFeatureItem = (
  detail: MovieDetails & WithImages,
): IndexFeatureHeroItem =>
  ({
    ...detail,
    media_type: "movie" as const,
    genre_ids: detail.genres.map((genre) => genre.id),
    backdrop_path: pickHeroBackdropPath(detail),
    logo: selectLogo(detail.images?.logos),
  }) as IndexFeatureHeroItem;

const mapTvHubFeatureItem = (
  detail: TvShowDetails & WithImages,
): IndexFeatureHeroItem =>
  ({
    ...detail,
    media_type: "tv" as const,
    genre_ids: detail.genres.map((genre) => genre.id),
    backdrop_path: pickHeroBackdropPath(detail),
    logo: selectLogo(detail.images?.logos),
  }) as IndexFeatureHeroItem;

const enrichHubFeatureItem = async (
  featured: IndexFeatureHeroItem,
  mediaType: "movie" | "tv",
): Promise<IndexFeatureHeroItem> => {
  try {
    if (mediaType === "movie") {
      const detail = await tmdb.movie.detail<WithImages>({
        id: featured.id,
        append: "images",
      });
      return mapMovieHubFeatureItem(detail);
    }

    const detail = await tmdb.tv.detail<WithImages>({
      id: featured.id,
      append: "images",
    });
    return mapTvHubFeatureItem(detail);
  } catch {
    return featured;
  }
};

export const buildCatalogHubFeature = async ({
  candidates,
  mediaType,
  pick,
  toBackdrop,
}: {
  candidates: MediaItem[];
  mediaType: "movie" | "tv";
  pick: (items: MediaItem[]) => MediaItem | undefined;
  toBackdrop: (item: IndexFeatureHeroItem) => PageBackdrop | null;
}): Promise<CatalogHubFeature | null> => {
  const featured = pick(candidates);
  if (!featured) return null;

  const featuredItem = featured as IndexFeatureHeroItem;
  const featureCandidates = [
    featuredItem,
    ...candidates.filter((candidate) => candidate.id !== featuredItem.id),
  ].slice(0, 5);
  const items = await Promise.all(
    featureCandidates.map((candidate) =>
      enrichHubFeatureItem(candidate as IndexFeatureHeroItem, mediaType),
    ),
  );
  const item = items[0] ?? featuredItem;

  return {
    item,
    items,
    backdrop: toBackdrop(item) ?? toBackdrop(featuredItem),
  };
};

const usDiscoverMovieParams = () => {
  const { gte, lte } = getRollingYearDateRangeUtc();
  return {
    watch_region: TMDB_WATCH_REGION,
    with_origin_country: "US",
    page: "1",
    sort_by: "popularity.desc" as const,
    "primary_release_date.gte": gte,
    "primary_release_date.lte": lte,
  };
};

const usDiscoverTvParams = () => {
  const { gte, lte } = getRollingYearDateRangeUtc();
  return {
    watch_region: TMDB_WATCH_REGION,
    with_origin_country: "US",
    page: "1",
    sort_by: "popularity.desc" as const,
    "first_air_date.gte": gte,
    "first_air_date.lte": lte,
  };
};

const loadPastYearPopularMovieHubFeature = cache(
  async (): Promise<CatalogHubFeature | null> => {
    const { results } = await tmdb.discover.movie(usDiscoverMovieParams());
    const movies = filterReleasedMovies(results ?? []);

    return buildCatalogHubFeature({
      candidates: movies,
      mediaType: "movie",
      pick: pickMostPopularHubFeatured,
      toBackdrop: toMovieHubBackdrop,
    });
  },
);

/** Past-year US movies by TMDB popularity (home `/` hub). */
export const getHomeMovieHubFeature = loadPastYearPopularMovieHubFeature;

const MOVIES_HUB_ACCLAIMED_MIN_VOTE_COUNT = 3_000;
const MOVIES_HUB_ACCLAIMED_MIN_VOTE_AVERAGE = 7.8;

const acclaimedDiscoverMovieParams = () => ({
  watch_region: TMDB_WATCH_REGION,
  page: "1",
  sort_by: "vote_average.desc" as const,
  "vote_count.gte": String(MOVIES_HUB_ACCLAIMED_MIN_VOTE_COUNT),
  "vote_average.gte": String(MOVIES_HUB_ACCLAIMED_MIN_VOTE_AVERAGE),
  "primary_release_date.lte": getAcclaimedHubMovieReleaseDateLte(),
});

const loadCriticallyAcclaimedMovieHubFeature = cache(
  async (): Promise<CatalogHubFeature | null> => {
    const { results } = await tmdb.discover.movie(
      acclaimedDiscoverMovieParams(),
    );
    const movies = filterReleasedMovies(results ?? []);

    return buildCatalogHubFeature({
      candidates: movies,
      mediaType: "movie",
      pick: pickCriticallyAcclaimedHubFeatured,
      toBackdrop: toMovieHubBackdrop,
    });
  },
);

/** Established, highly rated titles (`/movies` hub — not hype-driven). */
export const getMoviesCatalogHubFeature =
  loadCriticallyAcclaimedMovieHubFeature;

export const getTvHubFeature = cache(
  async (): Promise<CatalogHubFeature | null> => {
    const { results } = await tmdb.discover.tv(usDiscoverTvParams());
    const shows = filterReleasedTvShows(results ?? []);

    return buildCatalogHubFeature({
      candidates: shows,
      mediaType: "tv",
      pick: pickTvHubFeatured,
      toBackdrop: toTvHubBackdrop,
    });
  },
);
