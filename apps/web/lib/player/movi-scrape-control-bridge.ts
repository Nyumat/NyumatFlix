import type { MoviPlayerElement } from "@/lib/player/player-element";

const pokeMoviControlHandlers = (player: MoviPlayerElement): void => {
  player.style.removeProperty("cursor");
  player.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
  player.dispatchEvent(new MouseEvent("mousemove", { bubbles: false }));
};

const syncMoviScrapeControlsFallback = (player: MoviPlayerElement): void => {
  const root = player.shadowRoot;
  if (!root) {
    return;
  }

  const container = root.querySelector(".movi-controls-container");
  if (container instanceof HTMLElement) {
    if (!container.classList.contains("movi-controls-visible")) {
      container.classList.add("movi-controls-visible");
      container.classList.remove("movi-controls-hidden");
      player.classList.remove("movi-bar-collapsed");
      player.classList.add("movi-bar-visible");
    }
  }

  const overlay = root.querySelector(".movi-controls-overlay");
  if (overlay instanceof HTMLElement) {
    overlay.style.setProperty("opacity", "1", "important");
  }

  const slottedVideo = player.querySelector(':scope > video[slot="media"]');
  if (slottedVideo instanceof HTMLElement) {
    slottedVideo.style.removeProperty("cursor");
  }

  const shadowVideo = root.querySelector("video");
  if (shadowVideo instanceof HTMLElement) {
    shadowVideo.style.removeProperty("cursor");
  }
};

export const revealMoviScrapeControls = (player: MoviPlayerElement): void => {
  pokeMoviControlHandlers(player);
  syncMoviScrapeControlsFallback(player);
};

export const clearMoviScrapeOverlayInlineOpacity = (
  player: MoviPlayerElement,
): void => {
  const overlay = player.shadowRoot?.querySelector(".movi-controls-overlay");
  if (overlay instanceof HTMLElement) {
    overlay.style.removeProperty("opacity");
  }
};

export const attachMoviScrapeControlBridge = (
  container: HTMLElement,
  getPlayer: () => MoviPlayerElement | null,
): (() => void) => {
  const onPointerActivity = () => {
    const player = getPlayer();
    if (!player) {
      return;
    }
    revealMoviScrapeControls(player);
  };

  const onPointerLeave = () => {
    const player = getPlayer();
    if (!player) {
      return;
    }
    player.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
    clearMoviScrapeOverlayInlineOpacity(player);
  };

  container.addEventListener("pointerenter", onPointerActivity);
  container.addEventListener("pointermove", onPointerActivity);
  container.addEventListener("pointerleave", onPointerLeave);

  return () => {
    container.removeEventListener("pointerenter", onPointerActivity);
    container.removeEventListener("pointermove", onPointerActivity);
    container.removeEventListener("pointerleave", onPointerLeave);
  };
};
