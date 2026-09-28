import { usePlayIntentStore } from "@/lib/stores/play-intent-store";
import type { MediaItem } from "@/lib/domain/typings";
import { isTVShow } from "@/lib/domain/typings";
import type { LocalTvWatchCoords } from "@/lib/tv-watch-target";
import { hasTvAutoplayEligibility } from "@/lib/tv-watch-target";
import type { WatchlistItem } from "@/lib/domain/watchlist";

export const appendAutoplayParam = (href: string): string => {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}autoplay=true`;
};

/** True when navigation to `href` carries play intent (URL param or store). */
export const hasPlayIntent = (href: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(href, window.location.origin);
    if (url.searchParams.get("autoplay") === "true") return true;
  } catch {
    // fall through to store check
  }
  return usePlayIntentStore.getState().target?.href === href;
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
    options?.mediaType ??
    (options?.media && isTVShow(options.media) ? "tv" : "movie");

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

/**
 * Store-driven play navigation: pushes the PLAIN canonical href (so the RSC
 * prefetch cache hits) and stashes play intent for the destination hero to
 * consume. Shared/external links still use `?autoplay=true`.
 */
export const requestDetailPlay = (
  push: (href: string) => void,
  href: string,
  options?: {
    media?: MediaItem;
    mediaType?: "tv" | "movie";
    watchlistItem?: WatchlistItem | null;
    localCoords?: LocalTvWatchCoords | null;
  },
): void => {
  const mediaType =
    options?.mediaType ??
    (options?.media && isTVShow(options.media) ? "tv" : "movie");
  const eligible =
    mediaType === "movie" ||
    hasTvAutoplayEligibility(options?.watchlistItem, options?.localCoords);
  usePlayIntentStore
    .getState()
    .requestPlay(
      mediaType === "tv"
        ? { kind: "tv", href, eligible }
        : { kind: "movie", href },
    );
  push(href);
};
