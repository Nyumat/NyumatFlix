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
  hasInternalDetailItem(item)
    ? item
    : ({ ...item, href: "/tvshows" } as MediaItem);

const withAnimePageHrefs = (items: MediaItem[]) => items.map(withAnimePageHref);

const getItemTitle = (item: MediaItem) => {
  const title =
    "title" in item && typeof item.title === "string" ? item.title : "";
  const name = "name" in item && typeof item.name === "string" ? item.name : "";
  return title || name || "Untitled";
};

const getTitleKey = (item: MediaItem) =>
  getItemTitle(item)
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

const fetchAniListMediaPages = async ({
  pages = 1,
  perPage,
  params,
}: {
  pages?: number;
  perPage: number;
  params: Parameters<typeof fetchAniListPage>[0]["params"];
}) => {
  const rows = await Promise.all(
    Array.from({ length: pages }, (_, index) =>
      fetchAniListPage({
        page: index + 1,
        perPage,
        params,
      }),
    ),
  );

  return rows.flatMap((row) => row.media);
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
  const rows = await Promise.all([
    fetchAniListMediaPages({
      pages: 3,
      perPage: 24,
      params: { medium: "ANIME", sort: "TRENDING_DESC", genres: [] },
    }),
    fetchAniListMediaPages({
      pages: 3,
      perPage: 24,
      params: { medium: "ANIME", sort: "POPULARITY_DESC", genres: [] },
    }),
    fetchAniListMediaPages({
      pages: 3,
      perPage: 20,
      params: { medium: "ANIME", sort: "SCORE_DESC", genres: [] },
    }),
    fetchAniListMediaPages({
      pages: 3,
      perPage: 24,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        status: "RELEASING",
        genres: [],
      },
    }),
    fetchAniListMediaPages({
      pages: 3,
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        format: "MOVIE",
        genres: [],
      },
    }),
  ]);

  const [trendingItems, popularItems, topItems, airingItems, movieItems] =
    await Promise.all(
      rows.map((row, index) => {
        const maxLookups = index < 4 ? 18 : 14;
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
  const rows = await Promise.all([
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Action"],
      },
    }),
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Adventure"],
      },
    }),
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Comedy"],
      },
    }),
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Fantasy"],
      },
    }),
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Romance"],
      },
    }),
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Sci-Fi"],
      },
    }),
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Slice of Life"],
      },
    }),
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Supernatural"],
      },
    }),
  ]);

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
      enrichAniListMediaItemsWithTmdb(row.media, 6).then(withAnimePageHrefs),
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
  ["anime-home-core-hub-data"],
  { revalidate: ANIME_HOME_REVALIDATE_SECONDS },
);

const AnimeCoreHubSections = async () => {
  const { trendingItems, popularItems, topItems, airingItems, movieItems } =
    await fetchAnimeCoreHubData();
  const seenSectionTitles = new Set<string>();

  const playableTrendingItems = takeFreshItems(
    trendingItems.filter(hasInternalDetailItem),
    36,
    seenSectionTitles,
  );
  const playablePopularItems = takeFreshItems(
    popularItems.filter(hasInternalDetailItem),
    30,
    seenSectionTitles,
  );
  const playableTopItems = takeFreshItems(
    topItems.filter(hasInternalDetailItem),
    20,
    seenSectionTitles,
  );
  const playableAiringItems = takeFreshItems(
    airingItems.filter(hasInternalDetailItem),
    24,
    seenSectionTitles,
  );
  const playableMovieItems = takeFreshItems(
    movieItems.filter(hasInternalDetailItem),
    12,
    seenSectionTitles,
  );

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
        title="Trending Anime"
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
        title="Popular Anime"
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
        title="Anime Movies"
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

  const playableActionItems = actionItems.filter(hasInternalDetailItem);
  const playableAdventureItems = adventureItems.filter(hasInternalDetailItem);
  const playableComedyItems = comedyItems.filter(hasInternalDetailItem);
  const playableFantasyItems = fantasyItems.filter(hasInternalDetailItem);
  const playableRomanceItems = romanceItems.filter(hasInternalDetailItem);
  const playableSciFiItems = sciFiItems.filter(hasInternalDetailItem);
  const playableSliceOfLifeItems = sliceOfLifeItems.filter(
    hasInternalDetailItem,
  );
  const playableSupernaturalItems = supernaturalItems.filter(
    hasInternalDetailItem,
  );
  const genreSeenTitles = new Set<string>();
  const genreRows = [
    {
      title: "Action Anime",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Action"],
      }),
      items: playableActionItems,
    },
    {
      title: "Adventure Anime",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Adventure"],
      }),
      items: playableAdventureItems,
    },
    {
      title: "Comedy Anime",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Comedy"],
      }),
      items: playableComedyItems,
    },
    {
      title: "Fantasy Anime",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Fantasy"],
      }),
      items: playableFantasyItems,
    },
    {
      title: "Romance Anime",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Romance"],
      }),
      items: playableRomanceItems,
    },
    {
      title: "Sci-Fi Anime",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Sci-Fi"],
      }),
      items: playableSciFiItems,
    },
    {
      title: "Slice of Life Anime",
      href: buildAniListUrl({
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        genres: ["Slice of Life"],
      }),
      items: playableSliceOfLifeItems,
    },
    {
      title: "Supernatural Anime",
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
          items={asTvItems(takeFreshItems(row.items, 14, genreSeenTitles))}
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
