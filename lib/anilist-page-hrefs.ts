import type { MediaItem } from "@/lib/domain/typings";

type AnimePageItem = MediaItem & {
  href?: string;
  isAniListFallback?: boolean;
};

const isExternalHref = (href: string) =>
  /^https?:\/\//i.test(href) || href.includes("anilist.co");

/** Keep anime hub/grid links on NyumatFlix — never outbound to AniList. */
export const withAnimePageHref = (item: MediaItem): MediaItem => {
  const animeItem = item as AnimePageItem;

  if (animeItem.isAniListFallback) {
    return { ...item, href: "/tvshows" } as MediaItem;
  }

  const existingHref =
    typeof animeItem.href === "string" ? animeItem.href : undefined;
  if (existingHref && !isExternalHref(existingHref)) {
    return item;
  }

  const detailHref =
    item.media_type === "movie" ? `/movies/${item.id}` : `/tvshows/${item.id}`;

  return { ...item, href: detailHref } as MediaItem;
};

export const withAnimePageHrefs = (items: MediaItem[]) =>
  items.map(withAnimePageHref);
