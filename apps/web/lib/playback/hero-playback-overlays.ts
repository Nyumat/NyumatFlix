import type { DirectPlaybackStatus } from "@nyumatflix/playback";

type HeroScrapeStatus = "idle" | "scraping" | "playing" | "error";

export type HeroPlaybackOverlayState = {
  keepPlayer: boolean;
  showDiscoveryOverlay: boolean;
  showBufferingOverlay: boolean;
  showErrorOverlay: boolean;
  blurBackdrop: boolean;
  hideBackdrop: boolean;
};

export function resolveHeroPlaybackOverlays(input: {
  isDirectMode: boolean;
  scrapeStatus: HeroScrapeStatus;
  directStatus?: DirectPlaybackStatus;
  hasManifest: boolean;
  mediaReady: boolean;
  isResolvingEpisode?: boolean;
}): HeroPlaybackOverlayState {
  const isResolvingEpisode = input.isResolvingEpisode === true;

  if (input.isDirectMode) {
    const directStatus = input.directStatus ?? "idle";
    const keepPlayer =
      input.hasManifest &&
      (directStatus === "playing" || directStatus === "loading");
    const isDiscovering = directStatus === "loading" || directStatus === "idle";
    const showErrorOverlay = directStatus === "error";

    return {
      keepPlayer,
      showDiscoveryOverlay: isDiscovering && !keepPlayer,
      showBufferingOverlay: keepPlayer && !input.mediaReady,
      showErrorOverlay,
      blurBackdrop:
        showErrorOverlay ||
        (keepPlayer && !input.mediaReady) ||
        (isDiscovering && !keepPlayer),
      hideBackdrop: keepPlayer && input.mediaReady,
    };
  }

  const keepPlayer =
    input.hasManifest &&
    (input.scrapeStatus === "playing" || input.scrapeStatus === "scraping");
  const isDiscovering =
    input.scrapeStatus === "scraping" && !isResolvingEpisode;
  const showErrorOverlay = input.scrapeStatus === "error";

  return {
    keepPlayer,
    showDiscoveryOverlay: isDiscovering && !keepPlayer,
    showBufferingOverlay: keepPlayer && !input.mediaReady,
    showErrorOverlay,
    blurBackdrop:
      showErrorOverlay ||
      (isDiscovering && !keepPlayer) ||
      (keepPlayer && !input.mediaReady),
    hideBackdrop: keepPlayer && input.mediaReady,
  };
}
