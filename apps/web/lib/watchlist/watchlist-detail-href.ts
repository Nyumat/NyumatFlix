import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import { buildTmdbAnimeDetailHref } from "@/lib/tmdb-anime-route-id";
import type { MediaItem } from "@/lib/domain/typings";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import type { MalListIndexItem } from "@/lib/mal/list-index-shared";
import { isAnime } from "@/utils/anilist-helpers";

export const resolveWatchlistDetailHref = (
  item: MediaItem & { watchlistItem: WatchlistItem; sourceAnilistId?: number },
  malEntry?: MalListIndexItem,
): string => {
  const { mediaType } = item.watchlistItem;

  if (mediaType === "movie") {
    return `/movies/${item.id}`;
  }

  if (malEntry?.anilistId) {
    return buildAnilistTvDetailHref(malEntry.anilistId, {
      season: malEntry.season,
    });
  }

  if (
    typeof item.sourceAnilistId === "number" &&
    Number.isInteger(item.sourceAnilistId) &&
    item.sourceAnilistId > 0
  ) {
    return buildAnilistTvDetailHref(item.sourceAnilistId);
  }

  if (isAnime(item)) {
    return buildTmdbAnimeDetailHref(item.id, "tv");
  }

  return `/tvshows/${item.id}`;
};
