import "server-only";

import type { AnimeSeasonContext } from "@/lib/anime-season";
import { isAnimeBlocked } from "@/lib/anime-blocklist";
import type { MediaItem } from "@/lib/domain/typings";

export const ANIME_HUB_MIN_VISIBLE_ROW = 8;
export const ANIME_HUB_ROW_CAROUSEL = 20;
export const ANIME_HUB_ROW_RANKED = 24;
export const ANIME_HUB_ROW_GENRE = 18;

export type AnimeHubGenrePool = {
  genre: string;
  items: MediaItem[];
};

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

const getItemKey = (item: MediaItem) => {
  if ("sourceAnilistId" in item && typeof item.sourceAnilistId === "number") {
    return `anilist:${item.sourceAnilistId}`;
  }
  return `${item.media_type ?? "tv"}:${item.id}`;
};

const hasPoster = (item: MediaItem) =>
  typeof item.poster_path === "string" && item.poster_path.trim() !== "";

/** Pick carousel items with poster + within-row dedupe. */
export const pickHubCarouselItems = (
  pool: MediaItem[],
  count: number,
): MediaItem[] => {
  const picked: MediaItem[] = [];
  const seenKeys = new Set<string>();
  const seenTitles = new Set<string>();

  for (const item of pool) {
    if (!hasPoster(item)) continue;
    if (isAnimeBlocked(item)) continue;

    const key = getItemKey(item);
    const titleKey = normalizeAnimeTitle(getItemTitle(item));
    if (seenKeys.has(key)) continue;
    if (titleKey && seenTitles.has(titleKey)) continue;

    seenKeys.add(key);
    if (titleKey) seenTitles.add(titleKey);
    picked.push(item);
    if (picked.length >= count) break;
  }

  return picked;
};

class HubItemAllocator {
  private seenKeys = new Set<string>();
  private seenTitles = new Set<string>();

  take(pool: MediaItem[], count: number): MediaItem[] {
    const picked: MediaItem[] = [];

    for (const item of pool) {
      if (!hasPoster(item)) continue;
      if (isAnimeBlocked(item)) continue;

      const key = getItemKey(item);
      const titleKey = normalizeAnimeTitle(getItemTitle(item));
      if (this.seenKeys.has(key)) continue;
      if (titleKey && this.seenTitles.has(titleKey)) continue;

      this.seenKeys.add(key);
      if (titleKey) this.seenTitles.add(titleKey);
      picked.push(item);
      if (picked.length >= count) break;
    }

    return picked;
  }
}

export type AnimeHubCarouselRow = {
  title: string;
  href: string;
  items: MediaItem[];
};

export type AnimeHubLayout = {
  season: AnimeSeasonContext;
  hero: { label: string; items: MediaItem[] } | null;
  carouselRows: AnimeHubCarouselRow[];
  rankedRow: AnimeHubCarouselRow | null;
};

export type AnimeHubPools = {
  trending: MediaItem[];
  popular: MediaItem[];
  seasonPopular: MediaItem[];
  airing: MediaItem[];
  topRated: MediaItem[];
  movies: MediaItem[];
  hentai: MediaItem[];
  genreRows: AnimeHubGenrePool[];
};

export const buildAnimeHubLayout = (
  pools: AnimeHubPools,
  season: AnimeSeasonContext,
  links: {
    trending: string;
    popular: string;
    seasonPopular: string;
    airing: string;
    topRated: string;
    movies: string;
    hentai: string;
    genre: (name: string) => string;
  },
): AnimeHubLayout => {
  const allocator = new HubItemAllocator();

  const heroItems = allocator.take(pools.trending, 1);
  const topRatedRow = allocator.take(pools.topRated, ANIME_HUB_ROW_RANKED);
  const trendingRow = allocator.take(pools.trending, ANIME_HUB_ROW_CAROUSEL);
  const popularRow = allocator.take(pools.popular, ANIME_HUB_ROW_CAROUSEL);
  const seasonRow = allocator.take(pools.seasonPopular, ANIME_HUB_ROW_CAROUSEL);
  const airingRow = allocator.take(pools.airing, ANIME_HUB_ROW_CAROUSEL);
  const moviesRow = allocator.take(pools.movies, ANIME_HUB_ROW_CAROUSEL);

  const carouselRows: AnimeHubCarouselRow[] = [];
  const pushRow = (title: string, href: string, items: MediaItem[]) => {
    if (items.length < ANIME_HUB_MIN_VISIBLE_ROW) return;
    carouselRows.push({ title, href, items });
  };

  pushRow("Trending", links.trending, trendingRow);
  pushRow("Popular", links.popular, popularRow);
  pushRow(season.featuredLabel, links.seasonPopular, seasonRow);
  pushRow("Releasing", links.airing, airingRow);
  pushRow("Movies", links.movies, moviesRow);

  for (const { genre, items } of pools.genreRows) {
    pushRow(
      genre,
      links.genre(genre),
      allocator.take(items, ANIME_HUB_ROW_GENRE),
    );
  }

  pushRow(
    "Hentai",
    links.hentai,
    allocator.take(pools.hentai, ANIME_HUB_ROW_GENRE),
  );

  return {
    season,
    hero: heroItems.length > 0 ? { label: "Trending", items: heroItems } : null,
    carouselRows,
    rankedRow:
      topRatedRow.length >= ANIME_HUB_MIN_VISIBLE_ROW
        ? { title: "Highest Rated", href: links.topRated, items: topRatedRow }
        : null,
  };
};
