import { AniListFiltersDynamic } from "@/components/anilist/anilist-filters-dynamic";
import {
  AnimeHubAiringCarousel,
  AnimeHubGenreRowsPart1,
  AnimeHubGenreRowsPart2,
  AnimeHubGenreRowsPart3,
  AnimeHubHero,
  AnimeHubHentaiCarousel,
  AnimeHubMoviesCarousel,
  AnimeHubPopularCarousel,
  AnimeHubRankedRow,
  AnimeHubSeasonCarousel,
  AnimeHubTrendingCarousel,
} from "@/components/anilist/anime-hub-sections";
import { AnimeHeroFallback } from "@/components/anilist/anime-suspense-fallbacks";
import { AnimeResultsGrid } from "@/components/anilist/anime-results-grid";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import {
  CatalogGridFallback,
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { RecentlyWatchedRow } from "@/components/home/recently-watched-row";
import { Button } from "@/components/ui/button";
import {
  ANIME_BROWSE_PATH,
  isAniListResultsLayout,
  parseAniListSearchParams,
} from "@/lib/anilist";
import { normalizeRouteSearchParams } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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

const toPageNumber = (value: string | undefined) => {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const redirectLegacyAnimeModeParam = (sp: Record<string, string>) => {
  if (sp.mode !== "results") return;

  const { mode: _mode, ...rest } = sp;
  const next = new URLSearchParams(rest);
  const query = next.toString();
  redirect(query ? `/anime?${query}` : ANIME_BROWSE_PATH);
};

const AnimeHubHome = () => (
  <>
    <Suspense fallback={<AnimeHeroFallback />}>
      <AnimeHubHero />
    </Suspense>

    <Suspense fallback={<RecentlyWatchedRowFallback />}>
      <RecentlyWatchedRow scope="anime" />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubRankedRow />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubTrendingCarousel />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubPopularCarousel />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubSeasonCarousel />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubAiringCarousel />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubMoviesCarousel />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubGenreRowsPart1 />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubGenreRowsPart2 />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubGenreRowsPart3 />
    </Suspense>

    <Suspense fallback={<CatalogRowFallback />}>
      <AnimeHubHentaiCarousel />
    </Suspense>
  </>
);

export default async function AnimePage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);
  redirectLegacyAnimeModeParam(sp);

  const params = parseAniListSearchParams(sp);
  const currentPage = toPageNumber(sp.page);
  const isResultsLayout = isAniListResultsLayout(sp);

  return (
    <CatalogPageShell
      title="Anime"
      toolbar={<AniListFiltersDynamic serverParams={sp} />}
      action={
        <Button asChild variant="outline">
          <Link href={isResultsLayout ? "/anime" : ANIME_BROWSE_PATH}>
            {isResultsLayout ? "Anime home" : "All anime"}
          </Link>
        </Button>
      }
    >
      {isResultsLayout ? (
        <Suspense fallback={<CatalogGridFallback />}>
          <AnimeResultsGrid params={params} page={currentPage} />
        </Suspense>
      ) : (
        <AnimeHubHome />
      )}
    </CatalogPageShell>
  );
}
