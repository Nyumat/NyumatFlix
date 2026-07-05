import { describe, expect, it } from "vitest";

import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  dualCapabilityEmbedProviderIds,
  embedOnlyProviderIds,
  isTmdbScrapeProvider,
  TMDB_SCRAPE_PROVIDER_ORDER,
} from "@/lib/providers/registry";

describe("provider registry", () => {
  it("keeps TMDB scrape order aligned with embed overlap ids", () => {
    for (const id of TMDB_SCRAPE_PROVIDER_ORDER) {
      expect(isTmdbScrapeProvider(id)).toBe(true);
    }
  });

  it("lists embed-only providers not in the scrape chain", () => {
    expect(embedOnlyProviderIds()).toEqual([
      "superembed",
      "111movies",
      "vidfast",
      "videasy",
    ]);
  });

  it("lists dual-capability providers for embed sub-picker", () => {
    expect(dualCapabilityEmbedProviderIds()).toEqual([
      "vidsrc",
      "vidsrc-mirror",
      "2embed",
      "vidnest",
      "vidking",
    ]);
  });

  it("keeps anime scrape providers separate from TMDB scrape ids", () => {
    const tmdbIds = new Set<string>(TMDB_SCRAPE_PROVIDER_ORDER);
    for (const id of ANIME_SCRAPE_PROVIDER_ORDER) {
      expect(tmdbIds.has(id)).toBe(false);
    }
  });
});
