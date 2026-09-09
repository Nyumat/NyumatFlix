import { describe, expect, it } from "vitest";

import {
  clearMoviScrapeOverlayInlineOpacity,
  revealMoviScrapeControls,
} from "@/lib/player/movi-scrape-control-bridge";
import type { MoviPlayerElement } from "@/lib/player/player-element";

const createMockPlayer = (): MoviPlayerElement => {
  const overlay = document.createElement("div");
  overlay.className = "movi-controls-overlay";

  const container = document.createElement("div");
  container.className = "movi-controls-container movi-controls-hidden";

  const shadow = document.createElement("div");
  shadow.append(overlay, container);

  const player = document.createElement("div") as unknown as MoviPlayerElement;
  player.classList.add("movi-bar-collapsed");
  player.style.cursor = "none";
  Object.defineProperty(player, "shadowRoot", {
    value: {
      querySelector: (selector: string) => shadow.querySelector(selector),
    },
  });

  return player;
};

describe("movi-scrape-control-bridge", () => {
  it("reveals hidden scrape controls and clears host cursor", () => {
    const player = createMockPlayer();

    revealMoviScrapeControls(player);

    const container = player.shadowRoot?.querySelector(
      ".movi-controls-container",
    );
    const overlay = player.shadowRoot?.querySelector(".movi-controls-overlay");

    expect(player.style.cursor).toBe("");
    expect(player.classList.contains("movi-bar-collapsed")).toBe(false);
    expect(player.classList.contains("movi-bar-visible")).toBe(true);
    expect(container?.classList.contains("movi-controls-visible")).toBe(true);
    expect(container?.classList.contains("movi-controls-hidden")).toBe(false);
    expect(overlay).toHaveStyle({ opacity: "1" });
  });

  it("clears inline overlay opacity after hide", () => {
    const player = createMockPlayer();
    revealMoviScrapeControls(player);

    clearMoviScrapeOverlayInlineOpacity(player);

    const overlay = player.shadowRoot?.querySelector(".movi-controls-overlay");
    expect(overlay).not.toHaveStyle({ opacity: "1" });
  });
});
