import { AniListFiltersDynamic } from "@/components/anilist/anilist-filters-dynamic";
import { AnimeInfiniteGrid } from "@/components/anilist/anime-infinite-grid";
import { CatalogGridFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { QueryPageHeader } from "@/components/catalog/query-page-header";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { Button } from "@/components/ui/button";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { fetchAniListPage, parseAniListSearchParams } from "@/lib/anilist";
import { enrichAniListMediaItemsWithTmdb } from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/utils/typings";
import { normalizeRouteSearchParams } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 3600;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Browse Anime | NyumatFlix",
  description: "Explore AniList-powered anime search results and filters.",
  openGraph: {
    title: "Browse Anime | NyumatFlix",
    description: "Explore AniList-powered anime search results and filters.",
    type: "website",
    siteName: "NyumatFlix",
  },
};

const toPageNumber = (value: string | undefined) => {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const pageTitle = (params: ReturnType<typeof parseAniListSearchParams>) => {
  if (params.query) return `AniList results for "${params.query}"`;
  return "Anime";
};

const isInternalDetailItem = (item: MediaItem) =>
  !(
    "href" in item &&
    typeof item.href === "string" &&
    !item.href.startsWith("/")
  );

const withAnimePageHref = (item: MediaItem): MediaItem =>
  isInternalDetailItem(item)
    ? item
    : ({ ...item, href: "/tvshows" } as MediaItem);

const withAnimePageHrefs = (items: MediaItem[]) => items.map(withAnimePageHref);

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

export default async function AnimePage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const params = parseAniListSearchParams(sp);
  const currentPage = toPageNumber(sp.page);
  const title = pageTitle(params);

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
          <div className="container space-y-10">
            <QueryPageHeader title={title} backHref="/anime" />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <AniListFiltersDynamic serverParams={sp} />
              <Button asChild variant="outline">
                <Link href="/anime">Anime home</Link>
              </Button>
            </div>

            <Suspense fallback={<CatalogGridFallback />}>
              <AnimeResults params={params} page={currentPage} />
            </Suspense>
          </div>
        </section>
      </ContentContainer>

      <ScrollToTop />
    </div>
  );
}
