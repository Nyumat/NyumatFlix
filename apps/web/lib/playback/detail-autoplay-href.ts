import type { MediaItem } from "@/lib/domain/typings";
import { isTVShow } from "@/lib/domain/typings";
import type { LocalTvWatchCoords } from "@/lib/tv-watch-target";
import { hasTvAutoplayEligibility } from "@/lib/tv-watch-target";
import type { WatchlistItem } from "@/lib/domain/watchlist";

export const appendAutoplayParam = (href: string): string => {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}autoplay=true`;
};

export const buildDetailPlayHref = (
  href: string,
  options?: {
    media?: MediaItem;
    mediaType?: "tv" | "movie";
    watchlistItem?: WatchlistItem | null;
    localCoords?: LocalTvWatchCoords | null;
  },
): string => {
  const mediaType =
    options?.mediaType ?? (options?.media && isTVShow(options.media) ? "tv" : "movie");

  if (mediaType === "tv") {
    return hasTvAutoplayEligibility(
      options?.watchlistItem,
      options?.localCoords,
    )
      ? appendAutoplayParam(href)
      : href;
  }

  return appendAutoplayParam(href);
};
