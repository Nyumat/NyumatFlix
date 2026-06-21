import type { MediaItem } from "@/lib/domain/typings";

type AnimePageItem = MediaItem & {
  href?: string;
  isAniListFallback?: boolean;
  tmdbFallback?: { id: number; type: "movie" | "tv" };
};

const isExternalHref = (href: string) =>
  /^https?:\/\//i.test(href) || href.includes("anilist.co");

const getFallbackSearchHref = (item: MediaItem) => {
  const title =
    ("title" in item && typeof item.title === "string" && item.title) ||
    ("name" in item && typeof item.name === "string" && item.name) ||
    "";
  return title ? `/search?q=${encodeURIComponent(title)}` : "/search";
};

/** Keep anime hub/grid links on NyumatFlix — never outbound to AniList. */
export const withAnimePageHref = (item: MediaItem): MediaItem => {
  const animeItem = item as AnimePageItem;

  // Use real TMDB ID if available from a 429 TMDB fallback.
  if (animeItem.tmdbFallback) {
    const { id, type } = animeItem.tmdbFallback;
    return {
      ...item,
      href: type === "movie" ? `/movies/${id}` : `/tvshows/${id}`,
    } as MediaItem;
  }

  if (animeItem.isAniListFallback) {
    return { ...item, href: getFallbackSearchHref(item) } as MediaItem;
  }

  const existingHref =
    typeof animeItem.href === "string" ? animeItem.href : undefined;
  if (existingHref && !isExternalHref(existingHref)) {
    return item;
  }

  const id = Math.abs(item.id);
  const detailHref =
    item.media_type === "movie" ? `/movies/${id}` : `/tvshows/${id}`;

  return { ...item, href: detailHref } as MediaItem;
};

export const withAnimePageHrefs = (items: MediaItem[]) =>
  items.map(withAnimePageHref);
