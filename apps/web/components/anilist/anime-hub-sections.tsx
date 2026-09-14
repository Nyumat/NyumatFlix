import {
  IndexFeatureHero,
  type IndexFeatureHeroItem,
} from "@/components/catalog/index-feature-hero";
import { ContentRow } from "@/components/content/content-row";
import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import { TrendCarousel } from "@/components/trend/trend-client";
import { enrichAnimeHubFeatureTmdbImages } from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/lib/domain/typings";
import {
  enrichAnimeHubStandardRow,
  enrichAnimeHubTrendingRow,
  fetchAnimeHubAiringRaw,
  fetchAnimeHubMoviesRaw,
  fetchAnimeHubPastYearPopularRaw,
  fetchAnimeHubPopularRaw,
  fetchAnimeHubSeasonPopularRaw,
  fetchAnimeHubTopRatedRaw,
  fetchAnimeHubTrendingRaw,
  getAnimeHubLinks,
  getAnimeHubSeasonLabel,
} from "@/lib/server/anime-hub-data";
import {
  ANIME_HUB_MIN_VISIBLE_ROW,
  ANIME_HUB_ROW_CAROUSEL,
  ANIME_HUB_ROW_RANKED,
  pickHubCarouselItems,
} from "@/lib/server/anime-hub-layout";
import type { TvShowWithMediaType } from "@/tmdb/models";
import { tmdbImage } from "@/tmdb/utils";
import { cache } from "react";

const asTvItems = (items: MediaItem[]) =>
  items as unknown as TvShowWithMediaType[];

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const pickAnimeMainstreamFeatured = (items: MediaItem[]) => {
  const withArt = items.filter(
    (item) => Boolean(item.backdrop_path) || Boolean(item.poster_path),
  );
  if (withArt.length === 0) return null;

  return withArt.reduce((best, item) => {
    const bestScore = best.popularity ?? 0;
    const itemScore = item.popularity ?? 0;
    return itemScore > bestScore ? item : best;
  });
};

const getAnimeHubFeature = cache(async () => {
  const raw = await fetchAnimeHubPastYearPopularRaw();
  const items = await enrichAnimeHubTrendingRow(raw);
  const picked = pickAnimeMainstreamFeatured(items) ?? items[0] ?? null;
  if (!picked) return null;
  const featureItems = [
    picked,
    ...items.filter((item) => item.id !== picked.id),
  ].slice(0, 5);
  const enrichedItems = await Promise.all(
    featureItems.map((item) => enrichAnimeHubFeatureTmdbImages(item)),
  );
  return {
    item: (enrichedItems[0] ?? picked) as unknown as IndexFeatureHeroItem,
    items: enrichedItems as unknown as IndexFeatureHeroItem[],
  };
});

export async function getAnimeHubAmbientBackdrop(): Promise<PageBackdrop | null> {
  const featured = await getAnimeHubFeature();
  const backdropPath =
    featured?.item.backdrop_path ?? featured?.item.poster_path;

  if (!backdropPath || !featured) return null;

  return {
    imageUrl: tmdbImage.backdrop(backdropPath, "w1280"),
    alt:
      getString(featured.item.title) ||
      getString(featured.item.name) ||
      "Featured anime",
    priority: true,
  };
}

type HubTrendCarouselProps = {
  title: string;
  href: string;
  items: MediaItem[];
  count?: number;
};

const HubTrendCarousel = ({
  title,
  href,
  items,
  count = ANIME_HUB_ROW_CAROUSEL,
}: HubTrendCarouselProps) => {
  const picked = pickHubCarouselItems(items, count);
  if (picked.length < ANIME_HUB_MIN_VISIBLE_ROW) {
    return null;
  }

  return (
    <ContentReveal>
      <TrendCarousel
        type="tv"
        title={title}
        link={href}
        items={asTvItems(picked)}
        bleed
      />
    </ContentReveal>
  );
};

export async function AnimeHubHero() {
  const feature = await getAnimeHubFeature();
  if (!feature) {
    return null;
  }

  return (
    <ContentReveal>
      <IndexFeatureHero
        variant="anime"
        item={feature.item}
        items={feature.items}
        mediaType={feature.item.media_type === "movie" ? "movie" : "tv"}
        label="Trending"
        priority
      />
    </ContentReveal>
  );
}

export async function AnimeHubRankedRow() {
  const raw = await fetchAnimeHubTopRatedRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();
  const picked = pickHubCarouselItems(items, ANIME_HUB_ROW_RANKED);

  if (picked.length < ANIME_HUB_MIN_VISIBLE_ROW) {
    return null;
  }

  return (
    <ContentReveal>
      <ContentRow
        variant="ranked"
        title="Highest Rated"
        href={links.topRated}
        items={picked}
        bleed
      />
    </ContentReveal>
  );
}

export async function AnimeHubTrendingCarousel() {
  const raw = await fetchAnimeHubTrendingRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel title="Trending" href={links.trending} items={items} />
  );
}

export async function AnimeHubPopularCarousel() {
  const raw = await fetchAnimeHubPopularRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel title="Popular" href={links.popular} items={items} />
  );
}

export async function AnimeHubSeasonCarousel() {
  const raw = await fetchAnimeHubSeasonPopularRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel
      title={getAnimeHubSeasonLabel()}
      href={links.seasonPopular}
      items={items}
    />
  );
}

export async function AnimeHubAiringCarousel() {
  const raw = await fetchAnimeHubAiringRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return (
    <HubTrendCarousel title="Releasing" href={links.airing} items={items} />
  );
}

export async function AnimeHubMoviesCarousel() {
  const raw = await fetchAnimeHubMoviesRaw();
  const items = await enrichAnimeHubStandardRow(raw);
  const links = getAnimeHubLinks();

  return <HubTrendCarousel title="Movies" href={links.movies} items={items} />;
}
