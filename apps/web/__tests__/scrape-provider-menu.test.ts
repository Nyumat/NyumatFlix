import { describe, expect, it } from "vitest";

import {
  areScrapeProvidersExhausted,
  mergeScrapeProviderMenu,
  sortScrapeProvidersForMenu,
} from "@/lib/scrape/scrape-provider-menu";
import type { ScrapeItem } from "@/lib/scrape/types";

const providers = [
  { providerId: "vidking", name: "VidKing" },
  { providerId: "vidsrc", name: "VidSrc" },
  { providerId: "vidrock", name: "VidRock" },
  { providerId: "vixsrc", name: "VixSrc" },
] as const;

describe("sortScrapeProvidersForMenu", () => {
  it("pins a successful provider first and pushes failures to the end", () => {
    const items: ScrapeItem[] = [
      {
        providerId: "vidking",
        name: "VidKing",
        status: "success",
      },
      {
        providerId: "vidrock",
        name: "VidRock",
        status: "failure",
        error: "Sources failed",
      },
      {
        providerId: "vixsrc",
        name: "VixSrc",
        status: "unavailable",
      },
    ];

    expect(
      sortScrapeProvidersForMenu([...providers], items, "vidking").map(
        (provider) => provider.providerId,
      ),
    ).toEqual(["vidking", "vidsrc", "vidrock", "vixsrc"]);
  });
});

describe("areScrapeProvidersExhausted", () => {
  const order = providers.map((provider) => provider.providerId);

  it("returns false when any provider still has a success checkmark", () => {
    const items: ScrapeItem[] = [
      { providerId: "vidking", name: "VidKing", status: "success" },
      { providerId: "vidsrc", name: "VidSrc", status: "failure" },
      { providerId: "vidrock", name: "VidRock", status: "success" },
      { providerId: "vixsrc", name: "VixSrc", status: "failure" },
    ];

    expect(areScrapeProvidersExhausted(items, order)).toBe(false);
  });

  it("returns false when providers have not been tried yet", () => {
    const items: ScrapeItem[] = [
      { providerId: "vidking", name: "VidKing", status: "failure" },
      { providerId: "vidsrc", name: "VidSrc", status: "waiting" },
    ];

    expect(areScrapeProvidersExhausted(items, order)).toBe(false);
  });

  it("returns false when a menu provider is still idle", () => {
    const items: ScrapeItem[] = [
      { providerId: "vidking", name: "VidKing", status: "failure" },
    ];

    expect(areScrapeProvidersExhausted(items, order)).toBe(false);
  });

  it("returns true only when every provider is failure, unavailable, or skipped", () => {
    const partial: ScrapeItem[] = [
      { providerId: "vidking", name: "VidKing", status: "failure" },
      { providerId: "vidsrc", name: "VidSrc", status: "unavailable" },
    ];

    expect(areScrapeProvidersExhausted(partial, order)).toBe(false);

    const exhausted: ScrapeItem[] = order.map((providerId) => ({
      providerId,
      name: providerId,
      status:
        providerId === "vidrock"
          ? ("unavailable" as const)
          : ("failure" as const),
    }));

    expect(areScrapeProvidersExhausted(exhausted, order)).toBe(true);
  });
});

describe("mergeScrapeProviderMenu", () => {
  it("attaches scrape statuses to sorted provider entries", () => {
    const items: ScrapeItem[] = [
      {
        providerId: "vidrock",
        name: "VidRock",
        status: "failure",
        error: "No stream",
      },
    ];

    expect(mergeScrapeProviderMenu([...providers], items)).toEqual([
      { providerId: "vidking", name: "VidKing", status: "idle" },
      { providerId: "vidsrc", name: "VidSrc", status: "idle" },
      { providerId: "vixsrc", name: "VixSrc", status: "idle" },
      {
        providerId: "vidrock",
        name: "VidRock",
        status: "failure",
        error: "No stream",
      },
    ]);
  });
});
