import "server-only";

import type { IndexFeatureHeroItem } from "@/components/catalog/index-feature-hero";
import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import { TMDB_WATCH_REGION } from "@/lib/constants";
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
import {
  mergeFeaturedHeroItems,
  selectFeaturedEntriesForHub,
  type HeroFeaturedHubKind,
} from "@/lib/flags/hero-featured-items";
import { hydrateFeaturedHubEntries } from "@/lib/flags/hero-featured-hydration";
import {
  applyHeroBackdropOverride,
  getHeroBackdropOverrides,
} from "@/lib/flags/hero-backdrop-overrides-server";
import {
  enrichTmdbIndexHeroItem,
  type TmdbIndexHeroMediaType,
} from "@/lib/server/tmdb-index-hero-enrichment";
import { tmdb } from "@/tmdb/api";
import { tmdbImage } from "@/tmdb/utils";
import { getSnapshotHomeHero } from "@/lib/server/hub-snapshots";
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

export type { TmdbIndexHeroMediaType } from "@/lib/server/tmdb-index-hero-enrichment";
export { enrichTmdbIndexHeroItem } from "@/lib/server/tmdb-index-hero-enrichment";

const buildAutomaticHubHeroItems = async ({
  candidates,
  mediaType,
  pick,
  overrides,
}: {
  candidates: MediaItem[];
  mediaType: TmdbIndexHeroMediaType;
  pick: (items: MediaItem[]) => MediaItem | undefined;
  overrides: Awaited<ReturnType<typeof getHeroBackdropOverrides>>;
}): Promise<IndexFeatureHeroItem[]> => {
  const featured = pick(candidates);
  if (!featured) {
    return [];
  }

  const featuredItem = featured as IndexFeatureHeroItem;
  const featureCandidates = [
    featuredItem,
    ...candidates.filter((candidate) => candidate.id !== featuredItem.id),
  ].slice(0, 5);
  const enrichedItems = await Promise.all(
    featureCandidates.map((candidate) =>
      enrichTmdbIndexHeroItem(candidate as IndexFeatureHeroItem, mediaType),
    ),
  );

  return enrichedItems.map((item) =>
    applyHeroBackdropOverride(item, overrides, {
      mediaType: item.media_type ?? mediaType,
      tmdbId: item.id,
    }),
  );
};

export const buildCatalogHubFeature = async ({
  candidates,
  mediaType,
  pick,
  toBackdrop,
  hubKind = mediaType,
}: {
  candidates: MediaItem[];
  mediaType: TmdbIndexHeroMediaType;
  pick: (items: MediaItem[]) => MediaItem | undefined;
  toBackdrop: (item: IndexFeatureHeroItem) => PageBackdrop | null;
  hubKind?: HeroFeaturedHubKind;
}): Promise<CatalogHubFeature | null> => {
  const overrides = await getHeroBackdropOverrides();
  const pinnedEntries = selectFeaturedEntriesForHub(overrides, hubKind);
  const [pinnedItems, automaticItems] = await Promise.all([
    hydrateFeaturedHubEntries(pinnedEntries, overrides),
    buildAutomaticHubHeroItems({ candidates, mediaType, pick, overrides }),
  ]);

  if (pinnedItems.length === 0 && automaticItems.length === 0) {
    return null;
  }

  const items = mergeFeaturedHeroItems(pinnedItems, automaticItems);
  const item = items[0];
  if (!item) {
    return null;
  }

  return {
    item,
    items,
    backdrop: toBackdrop(item),
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

const resolveSnapshotHomeHero = async (): Promise<CatalogHubFeature | null> => {
  const snapshotHero = getSnapshotHomeHero();
  if (!snapshotHero?.items.length) {
    return null;
  }

  const overrides = await getHeroBackdropOverrides();
  const pinnedEntries = selectFeaturedEntriesForHub(overrides, "movie");
  const automaticItems = snapshotHero.items.map((item) =>
    applyHeroBackdropOverride(item, overrides, {
      mediaType: item.media_type ?? "movie",
      tmdbId: item.id,
    }),
  );
  const pinnedItems = await hydrateFeaturedHubEntries(pinnedEntries, overrides);
  const items = mergeFeaturedHeroItems(pinnedItems, automaticItems);
  const item = items[0];
  if (!item) {
    return null;
  }

  return {
    item,
    items,
    backdrop: toMovieHubBackdrop(item) ?? snapshotHero.backdrop,
  };
};

const loadPastYearPopularMovieHubFeature = cache(
  async (): Promise<CatalogHubFeature | null> => {
    const snapshotHero = await resolveSnapshotHomeHero();
    if (snapshotHero) {
      return snapshotHero;
    }

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

export const getHomeHubAmbientBackdrop =
  async (): Promise<PageBackdrop | null> =>
    (await getHomeMovieHubFeature())?.backdrop ?? null;

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
