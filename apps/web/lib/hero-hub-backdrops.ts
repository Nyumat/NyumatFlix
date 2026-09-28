import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import { tmdbImage } from "@/tmdb/utils";

type HeroBackdropItem = {
  backdrop_path?: string | null;
  poster_path?: string | null;
  title?: string | null;
  name?: string | null;
};

export const getHeroItemTitle = (
  item: HeroBackdropItem,
  mediaType: "movie" | "tv",
) =>
  mediaType === "movie"
    ? (item.title ?? item.name ?? "Featured title")
    : (item.name ?? item.title ?? "Featured title");

export const buildHeroBackdropFromItem = (
  item: HeroBackdropItem,
  mediaType: "movie" | "tv",
  priority = false,
): PageBackdrop | null => {
  const path = item.backdrop_path ?? item.poster_path;
  if (!path) return null;

  return {
    imageUrl: tmdbImage.backdrop(path, "original"),
    alt: getHeroItemTitle(item, mediaType),
    priority,
  };
};

export const buildHeroBackdropsFromItems = (
  items: HeroBackdropItem[],
  mediaType: "movie" | "tv",
  priority = false,
): Array<PageBackdrop | null> =>
  items.map((item) => buildHeroBackdropFromItem(item, mediaType, priority));
