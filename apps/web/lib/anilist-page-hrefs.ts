import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import { buildTmdbAnimeDetailHref } from "@/lib/tmdb-anime-route-id";
import type { MediaItem } from "@/lib/domain/typings";

type AnimePageItem = MediaItem & {
  href?: string;
  isAniListFallback?: boolean;
  sourceAnilistId?: number;
  tmdbFallback?: { id: number; type: "movie" | "tv" };
};

const isExternalHref = (href: string) =>
  /^https?:\/\//i.test(href) || href.includes("anilist.co");

const resolveAnimeCatalogAnilistId = (
  animeItem: AnimePageItem,
  item: MediaItem,
): number | null => {
  if (
    typeof animeItem.sourceAnilistId === "number" &&
    Number.isInteger(animeItem.sourceAnilistId) &&
    animeItem.sourceAnilistId > 0
  ) {
    return animeItem.sourceAnilistId;
  }

  if (animeItem.isAniListFallback && Number.isInteger(item.id) && item.id > 0) {
    return item.id;
  }

  return null;
};

/** Keep anime hub/grid links on NyumatFlix — never outbound to AniList or non-anime /tvshows routes. */
export const withAnimePageHref = (item: MediaItem): MediaItem => {
  const animeItem = item as AnimePageItem;
  const anilistId = resolveAnimeCatalogAnilistId(animeItem, item);

  if (item.media_type === "movie") {
    if (
      !animeItem.isAniListFallback &&
      Number.isInteger(item.id) &&
      item.id > 0
    ) {
      return {
        ...item,
        href: `/movies/${item.id}`,
      } as MediaItem;
    }

    if (animeItem.tmdbFallback?.type === "movie") {
      return {
        ...item,
        href: `/movies/${animeItem.tmdbFallback.id}`,
      } as MediaItem;
    }
  }

  if (anilistId) {
    return {
      ...item,
      href: buildAnilistTvDetailHref(anilistId),
    } as MediaItem;
  }

  if (animeItem.tmdbFallback) {
    const { id, type } = animeItem.tmdbFallback;
    return {
      ...item,
      href:
        type === "movie" ? `/movies/${id}` : buildTmdbAnimeDetailHref(id, "tv"),
    } as MediaItem;
  }

  const existingHref =
    typeof animeItem.href === "string" ? animeItem.href : undefined;
  if (existingHref && !isExternalHref(existingHref)) {
    return { ...item, href: existingHref } as MediaItem;
  }

  const id = Math.abs(item.id);
  const detailHref =
    item.media_type === "movie"
      ? `/movies/${id}`
      : buildTmdbAnimeDetailHref(id, "tv");

  return { ...item, href: detailHref } as MediaItem;
};

export const withAnimePageHrefs = (items: MediaItem[]) =>
  items.map(withAnimePageHref);
