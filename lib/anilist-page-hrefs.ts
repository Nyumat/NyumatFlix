import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import type { MediaItem } from "@/lib/domain/typings";

type AnimePageItem = MediaItem & {
  href?: string;
  isAniListFallback?: boolean;
  sourceAnilistId?: number;
  tmdbFallback?: { id: number; type: "movie" | "tv" };
};

const isExternalHref = (href: string) =>
  /^https?:\/\//i.test(href) || href.includes("anilist.co");

/** Keep anime hub/grid links on NyumatFlix — never outbound to AniList. */
export const withAnimePageHref = (item: MediaItem): MediaItem => {
  const animeItem = item as AnimePageItem;

  const withAnilistQuery = (href: string) => {
    if (
      typeof animeItem.sourceAnilistId !== "number" ||
      !Number.isInteger(animeItem.sourceAnilistId) ||
      animeItem.sourceAnilistId <= 0
    ) {
      return href;
    }

    const url = new URL(href, "https://nyumatflix.local");
    if (!url.searchParams.has("anilistId")) {
      url.searchParams.set("anilistId", String(animeItem.sourceAnilistId));
    }
    return `${url.pathname}${url.search}`;
  };

  if (animeItem.tmdbFallback) {
    const { id, type } = animeItem.tmdbFallback;
    return {
      ...item,
      href: withAnilistQuery(
        type === "movie" ? `/movies/${id}` : `/tvshows/${id}`,
      ),
    } as MediaItem;
  }

  if (animeItem.isAniListFallback) {
    const anilistId =
      typeof animeItem.sourceAnilistId === "number"
        ? animeItem.sourceAnilistId
        : item.id;
    return {
      ...item,
      href: buildAnilistTvDetailHref(anilistId),
    } as MediaItem;
  }

  const existingHref =
    typeof animeItem.href === "string" ? animeItem.href : undefined;
  if (existingHref && !isExternalHref(existingHref)) {
    return {
      ...item,
      href: withAnilistQuery(existingHref),
    } as MediaItem;
  }

  const id = Math.abs(item.id);
  const detailHref =
    item.media_type === "movie" ? `/movies/${id}` : `/tvshows/${id}`;

  return { ...item, href: withAnilistQuery(detailHref) } as MediaItem;
};

export const withAnimePageHrefs = (items: MediaItem[]) =>
  items.map(withAnimePageHref);
