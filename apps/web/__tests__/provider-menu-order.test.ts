import { describe, expect, it } from "vitest";

import {
  applyProviderMenuOrder,
  DEFAULT_PROVIDER_MENU_ORDER,
  sanitizeProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";
import {
  getDefaultSiteFlags,
  getTmdbScrapeProviderMenuOrder,
  orderVideoServersByMenu,
  resolveSiteFlags,
} from "@/lib/flags/site-flags";
import { DEFAULT_FLAG_VALUES } from "@/lib/flags/flag-catalog";

describe("provider menu order", () => {
  it("applies custom order while preserving unknown defaults", () => {
    expect(applyProviderMenuOrder(["a", "b", "c"], ["c", "a"])).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("sanitizes unknown ids out of stored config", () => {
    const config = sanitizeProviderMenuOrderConfig({
      embed: ["not-real", "vidsrc"],
      tmdbScrape: ["direct", "fake"],
      animeScrape: ["justanime", "also-fake"],
    });

    expect(config.embed[0]).toBe("vidsrc");
    expect(config.embed).not.toContain("not-real");
    expect(config.tmdbScrape[0]).toBe("direct");
    expect(config.animeScrape[0]).toBe("justanime");
  });

  it("resolves custom scrape order into site flags", () => {
    const flags = resolveSiteFlags(DEFAULT_FLAG_VALUES, undefined, {
      ...DEFAULT_PROVIDER_MENU_ORDER,
      tmdbScrape: [
        "vidsrc",
        "direct",
        ...DEFAULT_PROVIDER_MENU_ORDER.tmdbScrape,
      ],
    });

    expect(getTmdbScrapeProviderMenuOrder(flags).slice(0, 2)).toEqual([
      "vidsrc",
      "direct",
    ]);
  });

  it("orders embed servers for the selector", () => {
    const flags = {
      ...getDefaultSiteFlags(),
      providerMenuOrder: {
        ...DEFAULT_PROVIDER_MENU_ORDER,
        embed: ["vidfast", "vidsrc", ...DEFAULT_PROVIDER_MENU_ORDER.embed],
      },
    };

    expect(
      orderVideoServersByMenu(flags)
        .slice(0, 2)
        .map((server) => server.id),
    ).toEqual(["vidfast", "vidsrc"]);
  });
});
