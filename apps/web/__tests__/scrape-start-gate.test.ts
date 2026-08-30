import { describe, expect, it } from "vitest";

import {
  scrapeSessionKeyFor,
  shouldHoldScrapeForAnimeCoords,
} from "@/lib/anime/scrape-start-gate";

const base = {
  defaultAnilistId: 21,
  hasSelectedEpisode: true,
  animeCoordsStatus: "pending" as const,
  mappingConfidence: null,
  isDirectMode: false,
  isAnimeScrapeActive: false,
};

describe("shouldHoldScrapeForAnimeCoords", () => {
  it("holds while coords are pending for an anime show", () => {
    expect(shouldHoldScrapeForAnimeCoords(base)).toBe(true);
  });

  it("holds while coords are still idle before mapping starts", () => {
    expect(
      shouldHoldScrapeForAnimeCoords({
        ...base,
        animeCoordsStatus: "idle",
        mappingConfidence: null,
      }),
    ).toBe(true);
  });

  it("does not hold after coords miss so tmdb proxies can start", () => {
    expect(
      shouldHoldScrapeForAnimeCoords({
        ...base,
        animeCoordsStatus: "miss",
        mappingConfidence: "low",
      }),
    ).toBe(false);
  });

  it("does not hold when mapping is already high", () => {
    expect(
      shouldHoldScrapeForAnimeCoords({
        ...base,
        mappingConfidence: "high",
        animeCoordsStatus: "resolved",
      }),
    ).toBe(false);
  });

  it("does not hold once anime scrape is active even at low confidence", () => {
    expect(
      shouldHoldScrapeForAnimeCoords({
        ...base,
        mappingConfidence: "low",
        isAnimeScrapeActive: true,
      }),
    ).toBe(false);
  });
});

describe("scrapeSessionKeyFor", () => {
  it("namespaces direct vs tmdb so a direct start cannot skip the proxy race", () => {
    expect(scrapeSessionKeyFor("direct", "tv:37854:1:1")).not.toBe(
      scrapeSessionKeyFor("tmdb", "tv:37854:1:1"),
    );
  });
});
