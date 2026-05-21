import { AniListFiltersDynamic } from "@/components/anilist/anilist-filters-dynamic";
import { AnimeInfiniteGrid } from "@/components/anilist/anime-infinite-grid";
import { AnimeHero } from "@/components/anilist/anime-hero";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import {
  CatalogGridFallback,
  CatalogHeroPairFallback,
  CatalogRowFallback,
  CatalogSpotlightFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { ContentRow } from "@/components/content/content-row";
import { TrendCarousel } from "@/components/trend/trend-client";
import { Button } from "@/components/ui/button";
import {
  type AniListMedia,
  buildAniListUrl,
  fetchAniListPage,
  hasActiveAniListFilters,
  parseAniListSearchParams,
} from "@/lib/anilist";
import { enrichAniListMediaItemsWithTmdb } from "@/lib/anilist-tmdb";
import { normalizeRouteSearchParams } from "@/lib/utils";
import type { TvShowWithMediaType } from "@/tmdb/models";
import type { MediaItem } from "@/lib/domain/typings";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

const ANIME_HOME_REVALIDATE_SECONDS = 3600;
const ANIME_ROW_PAGE_SIZE = 30;
const CORE_ROW_FETCH_COUNT = 48;
const CORE_ROW_LOOKUP_COUNT = 18;
const MOVIE_ROW_FETCH_COUNT = 36;
const MOVIE_ROW_LOOKUP_COUNT = 14;
const GENRE_ROW_FETCH_COUNT = 36;
const GENRE_ROW_LOOKUP_COUNT = 10;

export const revalidate = ANIME_HOME_REVALIDATE_SECONDS;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Anime | NyumatFlix",
  description: "Browse curated AniList-powered anime discovery rows.",
  openGraph: {
    title: "Anime | NyumatFlix",
    description: "Browse curated AniList-powered anime discovery rows.",
    type: "website",
    siteName: "NyumatFlix",
  },
};

const asTvItems = (items: MediaItem[]) =>
  items as unknown as TvShowWithMediaType[];

type AnimeHubItem = MediaItem & {
  href?: string;
  isAniListFallback?: boolean;
};

const isInternalDetailHref = (href: string) =>
  /^\/(?:movies|tvshows)\/[^/?#]+(?:[?#].*)?$/.test(href);

const hasInternalDetailItem = (item: MediaItem) => {
  const animeItem = item as AnimeHubItem;
  if (animeItem.isAniListFallback) return false;
  if (typeof animeItem.href !== "string") return true;
  return isInternalDetailHref(animeItem.href);
};

const withAnimePageHref = (item: MediaItem): MediaItem =>
  (item as AnimeHubItem).isAniListFallback || hasInternalDetailItem(item)
    ? item
    : ({ ...item, href: "/tvshows" } as MediaItem);

const withAnimePageHrefs = (items: MediaItem[]) => items.map(withAnimePageHref);

const getItemTitle = (item: MediaItem) => {
  const title =
    "title" in item && typeof item.title === "string" ? item.title : "";
  const name = "name" in item && typeof item.name === "string" ? item.name : "";
  return title || name || "Untitled";
};

const normalizeAnimeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(the\s+)?final\s+season\b/g, " ")
    .replace(/\bfinal\s+chapters?\b/g, " ")
    .replace(/\bseason\s+\d+\b/g, " ")
    .replace(/\b\d+(st|nd|rd|th)\s+season\b/g, " ")
    .replace(/\bpart\s+\d+\b/g, " ")
    .replace(/\bmovie\b/g, " ")
    .split(/[:\-–—]/)[0]
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getTitleKey = (item: MediaItem) =>
  normalizeAnimeTitle(getItemTitle(item));

const getAniListMediaTitle = (item: AniListMedia) =>
  item.title.english || item.title.romaji || item.title.native || "Untitled";

const getAniListTitleKey = (item: AniListMedia) =>
  normalizeAnimeTitle(getAniListMediaTitle(item));

const dedupeMediaItems = (items: MediaItem[]) => {
  const seen = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: MediaItem[] = [];

  for (const item of items) {
    const sourceId =
      "sourceAnilistId" in item && typeof item.sourceAnilistId === "number"
        ? `anilist:${item.sourceAnilistId}`
        : `${item.media_type ?? "tv"}:${item.id}`;
    const titleKey = getTitleKey(item);
    if (seen.has(sourceId) || (titleKey && seenTitles.has(titleKey))) continue;
    seen.add(sourceId);
    if (titleKey) seenTitles.add(titleKey);
    deduped.push(item);
  }

  return deduped;
};

const takeFreshItems = (
  items: MediaItem[],
  count: number,
  seenTitles: Set<string>,
) => {
  const fresh: MediaItem[] = [];

  for (const item of dedupeMediaItems(items)) {
    const titleKey = getTitleKey(item);
    if (titleKey && seenTitles.has(titleKey)) continue;
    if (titleKey) seenTitles.add(titleKey);
    fresh.push(item);
    if (fresh.length >= count) break;
  }

  return fresh;
};

const fetchFreshAniListMedia = async ({
  maxPages,
  perPage,
  params,
  seenTitles,
  targetCount,
}: {
  maxPages: number;
  perPage: number;
  params: Parameters<typeof fetchAniListPage>[0]["params"];
  seenTitles: Set<string>;
  targetCount: number;
}) => {
  const fresh: AniListMedia[] = [];
  const seenIds = new Set<number>();

  for (let page = 1; page <= maxPages && fresh.length < targetCount; page++) {
    const row = await fetchAniListPage({ page, perPage, params });

    for (const item of row.media) {
      const titleKey = getAniListTitleKey(item);
      if (seenIds.has(item.id) || (titleKey && seenTitles.has(titleKey))) {
        continue;
      }

      seenIds.add(item.id);
      if (titleKey) seenTitles.add(titleKey);
      fresh.push(item);

      if (fresh.length >= targetCount) break;
    }

    if (!row.pageInfo.hasNextPage) break;
  }

  return fresh;
};

const toPageNumber = (value: string | undefined) => {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const pageDescription = (
  params: ReturnType<typeof parseAniListSearchParams>,
) => {
  if (params.query) return `AniList results for "${params.query}"`;
  if (params.genres.length > 0) {
    return `Anime filtered by ${params.genres.join(", ")}`;
  }
  return undefined;
};

type ParsedAniListParams = ReturnType<typeof parseAniListSearchParams>;

const AnimeResults = async ({
  params,
  page,
}: {
  params: ParsedAniListParams;
  page: number;
}) => {
  const data = await fetchAniListPage({
    page,
    perPage: 30,
    params,
  });
  const items = withAnimePageHrefs(
    await enrichAniListMediaItemsWithTmdb(data.media, 12),
  );

  return items.length > 0 ? (
    <AnimeInfiniteGrid
      initialItems={items}
      initialPage={data.pageInfo.currentPage}
      initialHasNextPage={data.pageInfo.hasNextPage}
      params={params}
    />
  ) : (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <p className="font-medium">No anime found.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Try removing a filter or searching for a broader title.
      </p>
    </div>
  );
};

type AnimeHubData = {
  trendingItems: MediaItem[];
  popularItems: MediaItem[];
  topItems: MediaItem[];
  airingItems: MediaItem[];
  movieItems: MediaItem[];
};

type AnimeGenreHubData = {
  actionItems: MediaItem[];
  adventureItems: MediaItem[];
  comedyItems: MediaItem[];
  fantasyItems: MediaItem[];
  romanceItems: MediaItem[];
  sciFiItems: MediaItem[];
  sliceOfLifeItems: MediaItem[];
  supernaturalItems: MediaItem[];
};

const fetchAnimeCoreHubDataUncached = async (): Promise<AnimeHubData> => {
  const seenTitles = new Set<string>();
  const trendingRow = await fetchFreshAniListMedia({
    maxPages: 4,
    perPage: ANIME_ROW_PAGE_SIZE,
    targetCount: CORE_ROW_FETCH_COUNT,
    seenTitles,
    params: { medium: "ANIME", sort: "TRENDING_DESC", genres: [] },
  });
  const popularRow = await fetchFreshAniListMedia({
    maxPages: 4,
    perPage: ANIME_ROW_PAGE_SIZE,
    targetCount: CORE_ROW_FETCH_COUNT,
    seenTitles,
    params: { medium: "ANIME", sort: "POPULARITY_DESC", genres: [] },
  });
  const topRow = await fetchFreshAniListMedia({
    maxPages: 4,
    perPage: ANIME_ROW_PAGE_SIZE,
    targetCount: CORE_ROW_FETCH_COUNT,
    seenTitles,
    params: { medium: "ANIME", sort: "SCORE_DESC", genres: [] },
  });
  const airingRow = await fetchFreshAniListMedia({
    maxPages: 4,
    perPage: ANIME_ROW_PAGE_SIZE,
    targetCount: CORE_ROW_FETCH_COUNT,
    seenTitles,
    params: {
      medium: "ANIME",
      sort: "POPULARITY_DESC",
      status: "RELEASING",
      genres: [],
    },
  });
  const movieRow = await fetchFreshAniListMedia({
    maxPages: 4,
    perPage: ANIME_ROW_PAGE_SIZE,
    targetCount: MOVIE_ROW_FETCH_COUNT,
    seenTitles,
    params: {
      medium: "ANIME",
      sort: "POPULARITY_DESC",
      format: "MOVIE",
      genres: [],
    },
  });

  const rows = [trendingRow, popularRow, topRow, airingRow, movieRow];

  const [trendingItems, popularItems, topItems, airingItems, movieItems] =
    await Promise.all(
      rows.map((row, index) => {
        const maxLookups =
          index < 4 ? CORE_ROW_LOOKUP_COUNT : MOVIE_ROW_LOOKUP_COUNT;
        return enrichAniListMediaItemsWithTmdb(row, maxLookups).then(
          withAnimePageHrefs,
        );
      }),
    );

  return {
    trendingItems,
    popularItems,
    topItems,
    airingItems,
    movieItems,
  };
};

const fetchAnimeGenreHubDataUncached = async (): Promise<AnimeGenreHubData> => {
  const seenTitles = new Set<string>();
  const genreParams = [
    ["Action"],
    ["Adventure"],
    ["Comedy"],
    ["Fantasy"],
    ["Romance"],
    ["Sci-Fi"],
    ["Slice of Life"],
    ["Supernatural"],
  ];
  const rows: AniListMedia[][] = [];

  for (const genres of genreParams) {
    rows.push(
      await fetchFreshAniListMedia({
        maxPages: 4,
        perPage: ANIME_ROW_PAGE_SIZE,
        targetCount: GENRE_ROW_FETCH_COUNT,
        seenTitles,
        params: {
          medium: "ANIME",
          sort: "POPULARITY_DESC",
          genres,
        },
      }),
    );
  }

  const [
    actionItems,
    adventureItems,
    comedyItems,
    fantasyItems,
    romanceItems,
    sciFiItems,
    sliceOfLifeItems,
    supernaturalItems,
  ] = await Promise.all(
    rows.map((row) =>
      enrichAniListMediaItemsWithTmdb(row, GENRE_ROW_LOOKUP_COUNT).then(
        withAnimePageHrefs,
      ),
    ),
  );

  return {
    actionItems,
    adventureItems,
    comedyItems,
    fantasyItems,
    romanceItems,
    sciFiItems,
    sliceOfLifeItems,
    supernaturalItems,
  };
};

const fetchAnimeCoreHubData = unstable_cache(
  fetchAnimeCoreHubDataUncached,
  ["anime-home-core-hub-data-deep-deduped"],
  { revalidate: ANIME_HOME_REVALIDATE_SECONDS },
);

const AnimeCoreHubSections = async () => {
  const { trendingItems, popularItems, topItems, airingItems, movieItems } =
    await fetchAnimeCoreHubData();
  const seenSectionTitles = new Set<string>();

  const playableTrendingItems = takeFreshItems(
    trendingItems,
    30,
    seenSectionTitles,
  );
  const playablePopularItems = takeFreshItems(
    popularItems,
    30,
    seenSectionTitles,
  );
  const playableTopItems = takeFreshItems(topItems, 30, seenSectionTitles);
  const playableAiringItems = takeFreshItems(
    airingItems,
    30,
    seenSectionTitles,
  );
  const playableMovieItems = takeFreshItems(movieItems, 24, seenSectionTitles);

  const featuredAnime = playableTrendingItems.slice(0, 1);
  const trendingRow = playableTrendingItems.slice(1);
  const popularHeroPair = playablePopularItems.slice(0, 2);
  const popularRow = playablePopularItems.slice(2);
  const airingHeroPair = playableAiringItems.slice(0, 2);
  const airingRow = playableAiringItems.slice(2);

  return (
    <>
      <AnimeHero
        items={featuredAnime}
        label="Trending now"
        priority
        count={1}
      />

      <TrendCarousel
        type="tv"
        title="Trending"
        link={buildAniListUrl({
          medium: "ANIME",
          sort: "TRENDING_DESC",
        })}
        items={asTvItems(trendingRow)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <AnimeHero items={popularHeroPair} label="Popular now" count={2} />
      </div>

      <TrendCarousel
        type="tv"
        title="Popular"
        link={buildAniListUrl({
          medium: "ANIME",
          sort: "POPULARITY_DESC",
        })}
        items={asTvItems(popularRow)}
      />

      <ContentRow
        variant="ranked"
        title="Top Rated"
        href={buildAniListUrl({
          medium: "ANIME",
          sort: "SCORE_DESC",
        })}
        items={playableTopItems}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <AnimeHero items={airingHeroPair} label="Airing now" count={2} />
      </div>

      <TrendCarousel
        type="tv"
        title="Airing Now"
        link={buildAniListUrl({
          medium: "ANIME",
          sort: "POPULARITY_DESC",
          status: "RELEASING",
        })}
        items={asTvItems(airingRow)}
      />

      <TrendCarousel
        type="tv"
        title="Movies"
        link={buildAniListUrl({
          medium: "ANIME",
          sort: "POPULARITY_DESC",
          format: "MOVIE",
        })}
        items={asTvItems(playableMovieItems)}
      />
    </>
  );
};

const AnimeGenreHubSections = async () => {
  const {
    actionItems,
    adventureItems,
    comedyItems,
    fantasyItems,
    romanceItems,
    sciFiItems,
    sliceOfLifeItems,
    supernaturalItems,
  } = await fetchAnimeGenreHubDataUncached();

  const playableActionItems = actionItems;
  const playableAdventureItems = adventureItems;
  const playableComedyItems = comedyItems;
  const playableFantasyItems = fantasyItems;
  const playableRomanceItems = romanceItems;
  const playableSciFiItems = sciFiItems;
  const playableSliceOfLifeItems = sliceOfLifeItems;
  const playableSupernaturalItems = supernaturalItems;
  const genreSeenTitles = new Set<string>();
  const genreRows = [
    {
      title: "Action",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Action"],
      }),
      items: playableActionItems,
    },
    {
      title: "Adventure",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Adventure"],
      }),
      items: playableAdventureItems,
    },
    {
      title: "Comedy",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Comedy"],
      }),
      items: playableComedyItems,
    },
    {
      title: "Fantasy",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Fantasy"],
      }),
      items: playableFantasyItems,
    },
    {
      title: "Romance",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Romance"],
      }),
      items: playableRomanceItems,
    },
    {
      title: "Sci-Fi",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Sci-Fi"],
      }),
      items: playableSciFiItems,
    },
    {
      title: "Slice of Life",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Slice of Life"],
      }),
      items: playableSliceOfLifeItems,
    },
    {
      title: "Supernatural",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Supernatural"],
      }),
      items: playableSupernaturalItems,
    },
  ];

  return (
    <>
      {genreRows.map((row) => (
        <TrendCarousel
          key={row.title}
          type="tv"
          title={row.title}
          link={row.href}
          items={asTvItems(takeFreshItems(row.items, 22, genreSeenTitles))}
        />
      ))}
    </>
  );
};

const AnimeHubFallback = () => (
  <>
    <CatalogSpotlightFallback />
    <CatalogRowFallback />
    <CatalogHeroPairFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogHeroPairFallback />
    <CatalogRowFallback />
  </>
);

const AnimeGenreRowsFallback = () => (
  <>
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
  </>
);

export default async function AnimePage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const params = parseAniListSearchParams(sp);
  const currentPage = toPageNumber(sp.page);
  const isResultsLayout = sp.mode === "results" || hasActiveAniListFilters(sp);
  const description = isResultsLayout ? pageDescription(params) : undefined;

  return (
    <CatalogPageShell
      title="Anime"
      description={description}
      toolbar={<AniListFiltersDynamic serverParams={sp} />}
      action={
        <Button asChild variant="outline">
          <Link href={isResultsLayout ? "/anime" : buildAniListUrl({})}>
            {isResultsLayout ? "Anime home" : "All anime"}
          </Link>
        </Button>
      }
    >
      {isResultsLayout ? (
        <Suspense fallback={<CatalogGridFallback />}>
          <AnimeResults params={params} page={currentPage} />
        </Suspense>
      ) : (
        <>
          <Suspense fallback={<AnimeHubFallback />}>
            <AnimeCoreHubSections />
          </Suspense>

          <Suspense fallback={<AnimeGenreRowsFallback />}>
            <AnimeGenreHubSections />
          </Suspense>
        </>
      )}
    </CatalogPageShell>
  );
}
