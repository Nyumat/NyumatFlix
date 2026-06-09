import { AniListFiltersDynamic } from "@/components/anilist/anilist-filters-dynamic";
import { AnimeInfiniteGrid } from "@/components/anilist/anime-infinite-grid";
import { AnimeHero } from "@/components/anilist/anime-hero";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import {
  CatalogGridFallback,
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
import { enrichAniListMediaItemsLightweight } from "@/lib/anilist-tmdb";
import { fetchAnimeHubLayout } from "@/lib/server/anime-hub-data";
import { normalizeRouteSearchParams } from "@/lib/utils";
import type { MediaItem } from "@/lib/domain/typings";
import type { TvShowWithMediaType } from "@/tmdb/models";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 3600;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_ANIME_DESCRIPTION =
  "Browse anime discovery rows powered by AniList.";

const pageDescription = (
  params: ReturnType<typeof parseAniListSearchParams>,
) => {
  if (params.query) return `AniList results for "${params.query}"`;
  if (params.genres.length > 0) {
    return `Anime filtered by ${params.genres.join(", ")}`;
  }
  if (params.season && params.year) {
    return `${params.season} ${params.year} anime`;
  }
  return undefined;
};

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const raw = await searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const params = parseAniListSearchParams(sp);
  const description = pageDescription(params) ?? DEFAULT_ANIME_DESCRIPTION;

  return {
    title: "Anime | NyumatFlix",
    description,
    openGraph: {
      title: "Anime | NyumatFlix",
      description,
      type: "website",
      siteName: "NyumatFlix",
    },
  };
}

const asTvItems = (items: MediaItem[]) =>
  items as unknown as TvShowWithMediaType[];

const toPageNumber = (value: string | undefined) => {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
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
  const items = await enrichAniListMediaItemsLightweight(data.media, 30);

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

const AnimeHubSections = async () => {
  const layout = await fetchAnimeHubLayout();
  const [trendingRow, popularRow, seasonRow, airingRow, ...restRows] =
    layout.carouselRows;

  return (
    <>
      {layout.hero ? (
        <AnimeHero
          items={layout.hero.items}
          label={layout.hero.label}
          priority
          count={1}
        />
      ) : null}

      {layout.rankedRow ? (
        <ContentRow
          variant="ranked"
          title={layout.rankedRow.title}
          href={layout.rankedRow.href}
          items={layout.rankedRow.items}
        />
      ) : null}

      {trendingRow ? (
        <TrendCarousel
          type="tv"
          title={trendingRow.title}
          link={trendingRow.href}
          items={asTvItems(trendingRow.items)}
        />
      ) : null}

      {popularRow ? (
        <TrendCarousel
          type="tv"
          title={popularRow.title}
          link={popularRow.href}
          items={asTvItems(popularRow.items)}
        />
      ) : null}

      {seasonRow ? (
        <TrendCarousel
          type="tv"
          title={seasonRow.title}
          link={seasonRow.href}
          items={asTvItems(seasonRow.items)}
        />
      ) : null}

      {airingRow ? (
        <TrendCarousel
          type="tv"
          title={airingRow.title}
          link={airingRow.href}
          items={asTvItems(airingRow.items)}
        />
      ) : null}

      {restRows.map((row) => (
        <TrendCarousel
          key={row.title}
          type="tv"
          title={row.title}
          link={row.href}
          items={asTvItems(row.items)}
        />
      ))}
    </>
  );
};

const AnimeHubFallback = () => (
  <>
    <CatalogSpotlightFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
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

  return (
    <CatalogPageShell
      title="Anime"
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
        <Suspense fallback={<AnimeHubFallback />}>
          <AnimeHubSections />
        </Suspense>
      )}
    </CatalogPageShell>
  );
}
