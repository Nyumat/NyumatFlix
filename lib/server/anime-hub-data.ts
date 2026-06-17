import "server-only";

import { filterAnimeBlocked, isAniListIdBlocked } from "@/lib/anime-blocklist";
import { getAnimeSeasonContext } from "@/lib/anime-season";
import {
  buildAniListUrl,
  fetchAniListPage,
  mapAniListMediaToMediaItem,
  type AniListMedia,
  type AniListSearchParams,
} from "@/lib/anilist";
import {
  enrichAniListMediaItemsLightweight,
  enrichAniListHubRow,
} from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/lib/domain/typings";
import { withAnimePageHrefs } from "@/lib/anilist-page-hrefs";
import {
  buildAnimeHubLayout,
  type AnimeHubLayout,
  type AnimeHubPools,
} from "@/lib/server/anime-hub-layout";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { runInChunks } from "@/lib/server/chunked-parallel";

export const ANIME_HOME_REVALIDATE_SECONDS = 3600;
const ANIME_ROW_PAGE_SIZE = 30;
const SEASON_ROW_TARGET = 40;
const GLOBAL_ENRICH_CHUNK_SIZE = 8;

/** Genre rows on the anime hub — AniList genre names, display order. */
export const ANIME_HUB_GENRES = [
  "Action",
  "Supernatural",
  "Comedy",
  "Adventure",
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Horror",
  "Slice of Life",
  "Drama",
  "Mystery",
  "Sports",
] as const;

const toAniListOnlyItems = (items: AniListMedia[]) =>
  filterAnimeBlocked(
    withAnimePageHrefs(
      items.filter(Boolean).map(
        (item) =>
          ({
            ...mapAniListMediaToMediaItem(item),
            sourceAnilistId: item.id,
            isAniListFallback: true,
          }) as MediaItem,
      ),
    ),
  );

const fetchAniListRow = async (
  params: AniListSearchParams,
  pages = 1,
): Promise<AniListMedia[]> => {
  const collected: AniListMedia[] = [];

  for (let page = 1; page <= pages; page++) {
    const response = await fetchAniListPage({
      page,
      perPage: ANIME_ROW_PAGE_SIZE,
      params,
    });
    collected.push(...response.media);
    if (
      !response.pageInfo.hasNextPage ||
      collected.length >= SEASON_ROW_TARGET
    ) {
      break;
    }
  }

  return collected
    .filter((item) => !isAniListIdBlocked(item.id))
    .slice(0, SEASON_ROW_TARGET);
};

type RowEnrichmentPlan = {
  media: AniListMedia[];
  fullEnrichCount: number;
  lightweightCount: number;
};

const enrichHubRowsGlobally = async (
  plans: RowEnrichmentPlan[],
): Promise<MediaItem[][]> => {
  const heroPlans = plans.filter((plan) => plan.fullEnrichCount > 0);
  const heroEnrichedByPlan = new Map<RowEnrichmentPlan, MediaItem[]>();

  await Promise.all(
    heroPlans.map(async (plan) => {
      const items = await enrichAniListHubRow(plan.media, {
        fullEnrichCount: plan.fullEnrichCount,
        lightweightCount: plan.fullEnrichCount,
        chunkSize: GLOBAL_ENRICH_CHUNK_SIZE,
        heroEnrichment: "fast",
      });
      heroEnrichedByPlan.set(plan, items);
    }),
  );

  const carouselItems: AniListMedia[] = [];
  const carouselSlots: Array<{ plan: RowEnrichmentPlan; index: number }> = [];

  for (const plan of plans) {
    for (
      let index = plan.fullEnrichCount;
      index < plan.lightweightCount;
      index++
    ) {
      const item = plan.media[index];
      if (!item) continue;
      carouselItems.push(item);
      carouselSlots.push({ plan, index });
    }
  }

  const enrichedCarouselItems =
    carouselItems.length > 0
      ? await enrichAniListMediaItemsLightweight(
          carouselItems,
          carouselItems.length,
          GLOBAL_ENRICH_CHUNK_SIZE,
        )
      : [];

  const carouselByPlan = new Map<RowEnrichmentPlan, Map<number, MediaItem>>();
  carouselSlots.forEach(({ plan, index }, slotIndex) => {
    const item = enrichedCarouselItems[slotIndex];
    if (!item) return;
    const rowMap = carouselByPlan.get(plan) ?? new Map<number, MediaItem>();
    rowMap.set(index, item);
    carouselByPlan.set(plan, rowMap);
  });

  return plans.map((plan) => {
    const heroItems = heroEnrichedByPlan.get(plan) ?? [];
    const carouselMap =
      carouselByPlan.get(plan) ?? new Map<number, MediaItem>();
    const effectiveCount = Math.min(plan.lightweightCount, plan.media.length);

    const merged: MediaItem[] = [];
    for (let index = 0; index < effectiveCount; index++) {
      const source = plan.media[index];
      if (!source) continue;

      if (index < plan.fullEnrichCount) {
        merged.push(heroItems[index] ?? toAniListOnlyItems([source])[0]!);
        continue;
      }

      merged.push(carouselMap.get(index) ?? toAniListOnlyItems([source])[0]!);
    }

    return merged;
  });
};

const fetchAnimeHubLayoutUncached = async (): Promise<AnimeHubLayout> => {
  const season = getAnimeSeasonContext();
  const base = { medium: "ANIME" as const, genres: [] as string[] };

  const rawFetchTasks = [
    () => fetchAniListRow({ ...base, sort: "TRENDING_DESC" }, 2),
    () => fetchAniListRow({ ...base, sort: "POPULARITY_DESC" }, 2),
    () =>
      fetchAniListRow(
        {
          ...base,
          sort: "POPULARITY_DESC",
          season: season.featuredSeason,
          year: season.featuredYear,
        },
        2,
      ),
    () =>
      fetchAniListRow(
        {
          ...base,
          sort: "POPULARITY_DESC",
          status: "RELEASING",
        },
        2,
      ),
    () => fetchAniListRow({ ...base, sort: "SCORE_DESC" }),
    () =>
      fetchAniListRow({
        ...base,
        sort: "POPULARITY_DESC",
        format: "MOVIE",
      }),
    ...ANIME_HUB_GENRES.map(
      (genre) => () =>
        fetchAniListRow(
          {
            ...base,
            sort: "POPULARITY_DESC",
            genres: [genre],
          },
          2,
        ),
    ),
  ];

  // Limit AniList concurrency to prevent 429 Rate Limits
  const rawResults = await runInChunks(rawFetchTasks, (task) => task(), 4);

  const [
    trendingRaw,
    popularRaw,
    seasonPopularRaw,
    airingRaw,
    topRatedRaw,
    moviesRaw,
    ...genreRaws
  ] = rawResults as AniListMedia[][];

  // Batch enrichment plans to process them globally and respect chunking limits
  const enrichmentPlans = [
    {
      media: trendingRaw,
      fullEnrichCount: 1,
      lightweightCount: trendingRaw.length,
    },
    {
      media: popularRaw,
      fullEnrichCount: 0,
      lightweightCount: popularRaw.length,
    },
    {
      media: seasonPopularRaw,
      fullEnrichCount: 0,
      lightweightCount: seasonPopularRaw.length,
    },
    {
      media: airingRaw,
      fullEnrichCount: 0,
      lightweightCount: airingRaw.length,
    },
    {
      media: topRatedRaw,
      fullEnrichCount: 0,
      lightweightCount: topRatedRaw.length,
    },
    {
      media: moviesRaw,
      fullEnrichCount: 0,
      lightweightCount: moviesRaw.length,
    },
    ...genreRaws.map((raw) => ({
      media: raw,
      fullEnrichCount: 0,
      lightweightCount: raw.length,
    })),
  ];

  const enrichedRows = await enrichHubRowsGlobally(enrichmentPlans);

  const [
    trending,
    popular,
    seasonPopular,
    airing,
    topRated,
    movies,
    ...genreItems
  ] = enrichedRows as MediaItem[][];

  const genreRows = ANIME_HUB_GENRES.map((genre, index) => ({
    genre,
    items: genreItems[index] ?? [],
  }));

  const pools: AnimeHubPools = {
    trending,
    popular,
    seasonPopular,
    airing,
    topRated,
    movies,
    genreRows,
  };

  const seasonLink = (extra: Partial<AniListSearchParams> = {}) =>
    buildAniListUrl({
      medium: "ANIME",
      sort: "POPULARITY_DESC",
      ...extra,
    });

  return buildAnimeHubLayout(pools, season, {
    trending: seasonLink({ sort: "TRENDING_DESC" }),
    popular: seasonLink({ sort: "POPULARITY_DESC" }),
    seasonPopular: seasonLink({
      sort: "POPULARITY_DESC",
      season: season.featuredSeason,
      year: season.featuredYear,
    }),
    airing: seasonLink({ sort: "POPULARITY_DESC", status: "RELEASING" }),
    topRated: seasonLink({ sort: "SCORE_DESC" }),
    movies: seasonLink({ sort: "POPULARITY_DESC", format: "MOVIE" }),
    genre: (genre) => seasonLink({ genres: [genre] }),
  });
};

const getCachedAnimeHubLayout = unstable_cache(
  fetchAnimeHubLayoutUncached,
  ["anime-home-season-hub-v6"],
  { revalidate: ANIME_HOME_REVALIDATE_SECONDS },
);

export const fetchAnimeHubLayout = cache(getCachedAnimeHubLayout);

/** @deprecated Use fetchAnimeHubLayout */
export const fetchAnimeFullHubData = fetchAnimeHubLayout;
