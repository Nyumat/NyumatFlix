import { AniListFiltersDynamic } from "@/components/anilist/anilist-filters-dynamic";
import { AnimeHero } from "@/components/anilist/anime-hero";
import {
  CatalogHeroPairFallback,
  CatalogRowFallback,
  CatalogSpotlightFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { ContentRow } from "@/components/content/content-row";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { TrendCarousel } from "@/components/trend";
import { Button } from "@/components/ui/button";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { buildAniListUrl, fetchAniListPage } from "@/lib/anilist";
import { enrichAniListMediaItemsWithTmdb } from "@/lib/anilist-tmdb";
import { normalizeRouteSearchParams } from "@/lib/utils";
import type { TvShowWithMediaType } from "@/tmdb/models";
import type { MediaItem } from "@/utils/typings";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 3600;

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

const AnimeHubSections = async () => {
  const [
    trendingAnime,
    popularAnime,
    topAnime,
    releasingAnime,
    actionAnime,
    romanceAnime,
  ] = await Promise.all([
    fetchAniListPage({
      perPage: 18,
      params: { medium: "ANIME", sort: "TRENDING_DESC", genres: [] },
    }),
    fetchAniListPage({
      perPage: 18,
      params: { medium: "ANIME", sort: "POPULARITY_DESC", genres: [] },
    }),
    fetchAniListPage({
      perPage: 18,
      params: { medium: "ANIME", sort: "SCORE_DESC", genres: [] },
    }),
    fetchAniListPage({
      perPage: 18,
      params: {
        medium: "ANIME",
        sort: "POPULARITY_DESC",
        status: "RELEASING",
        genres: [],
      },
    }),
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
        genres: ["Romance"],
      },
    }),
  ]);

  const [
    trendingItems,
    popularItems,
    topItems,
    releasingItems,
    actionItems,
    romanceItems,
  ] = await Promise.all([
    enrichAniListMediaItemsWithTmdb(trendingAnime.media, 10).then(
      withAnimePageHrefs,
    ),
    enrichAniListMediaItemsWithTmdb(popularAnime.media, 8).then(
      withAnimePageHrefs,
    ),
    enrichAniListMediaItemsWithTmdb(topAnime.media, 8).then(withAnimePageHrefs),
    enrichAniListMediaItemsWithTmdb(releasingAnime.media, 8).then(
      withAnimePageHrefs,
    ),
    enrichAniListMediaItemsWithTmdb(actionAnime.media, 6).then(
      withAnimePageHrefs,
    ),
    enrichAniListMediaItemsWithTmdb(romanceAnime.media, 6).then(
      withAnimePageHrefs,
    ),
  ]);
  const playableTrendingItems = trendingItems.filter(hasInternalDetailItem);
  const playablePopularItems = popularItems.filter(hasInternalDetailItem);
  const playableTopItems = topItems.filter(hasInternalDetailItem);
  const playableReleasingItems = releasingItems.filter(hasInternalDetailItem);
  const playableActionItems = actionItems.filter(hasInternalDetailItem);
  const playableRomanceItems = romanceItems.filter(hasInternalDetailItem);

  const featuredAnime = playableTrendingItems.slice(0, 1);
  const trendingRow = playableTrendingItems.slice(1);
  const popularHeroPair = playablePopularItems.slice(0, 2);
  const popularRow = playablePopularItems.slice(2);
  const releasingHeroPair = playableReleasingItems.slice(0, 2);
  const releasingRow = playableReleasingItems.slice(2);

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
        title="Top Rated Anime"
        href={buildAniListUrl({
          medium: "ANIME",
          sort: "SCORE_DESC",
        })}
        items={playableTopItems}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <AnimeHero items={releasingHeroPair} label="Releasing now" count={2} />
      </div>

      <TrendCarousel
        type="tv"
        title="Currently Releasing Anime"
        link={buildAniListUrl({
          medium: "ANIME",
          sort: "POPULARITY_DESC",
          status: "RELEASING",
        })}
        items={asTvItems(releasingRow)}
      />

      <TrendCarousel
        type="tv"
        title="Action Anime"
        link={buildAniListUrl({
          medium: "ANIME",
          sort: "POPULARITY_DESC",
          genres: ["Action"],
        })}
        items={asTvItems(playableActionItems)}
      />

      <TrendCarousel
        type="tv"
        title="Romance Anime"
        link={buildAniListUrl({
          medium: "ANIME",
          sort: "POPULARITY_DESC",
          genres: ["Romance"],
        })}
        items={asTvItems(playableRomanceItems)}
      />
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
    <CatalogRowFallback />
  </>
);

export default async function AnimeBrowsePage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
          <div className="container space-y-10">
            <header className="space-y-2 text-center md:text-left">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Anime
              </h1>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <AniListFiltersDynamic serverParams={sp} />
              <Button asChild variant="outline">
                <Link href="/anime/browse">All anime</Link>
              </Button>
            </div>

            <Suspense fallback={<AnimeHubFallback />}>
              <AnimeHubSections />
            </Suspense>
          </div>
        </section>
      </ContentContainer>

      <ScrollToTop />
    </div>
  );
}
