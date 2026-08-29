import { describe, expect, it } from "vitest";

import {
  ANIME_PLAYBACK_SCRAPE_PROVIDER_ORDER,
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
      "vidsrc-mirror",
      "superembed",
      "111movies",
      "vidfast",
      "vidnest",
      "vidlink",
      "vidcore",
      "1embed",
      "vidlux",
      "vixsrc",
      "hentaini",
    ]);
  });

  it("keeps unreliable TMDB scrape providers last in the chain", () => {
    const order = TMDB_SCRAPE_PROVIDER_ORDER;
    expect(order.at(-1)).toBe("2embed");
    expect(order).not.toContain("vixsrc");
  });

  it("lists dual-capability providers for embed sub-picker", () => {
    expect(dualCapabilityEmbedProviderIds()).toEqual([
      "vidsrc",
      "vidking",
      "videasy",
      "2embed",
    ]);
  });

  it("keeps embed-only providers outside scrape chains", () => {
    expect(TMDB_SCRAPE_PROVIDER_ORDER).not.toContain("vixsrc");
    expect(ANIME_SCRAPE_PROVIDER_ORDER).not.toContain("hentaini");
    expect(ANIME_SCRAPE_PROVIDER_ORDER).not.toContain("animepahe");
    expect(ANIME_SCRAPE_PROVIDER_ORDER).not.toContain("anikuro");
    expect(embedOnlyProviderIds()).toEqual(
      expect.arrayContaining(["vixsrc", "hentaini"]),
    );
  });

  it("keeps anime scrape providers separate from TMDB scrape ids", () => {
    const tmdbIds = new Set<string>(TMDB_SCRAPE_PROVIDER_ORDER);
    for (const id of ANIME_SCRAPE_PROVIDER_ORDER) {
      expect(tmdbIds.has(id)).toBe(false);
    }
  });

  it("chains anime and tmdb providers for anime playback scrape", () => {
    expect(
      ANIME_PLAYBACK_SCRAPE_PROVIDER_ORDER.slice(
        0,
        ANIME_SCRAPE_PROVIDER_ORDER.length,
      ),
    ).toEqual([...ANIME_SCRAPE_PROVIDER_ORDER]);
    expect(
      ANIME_PLAYBACK_SCRAPE_PROVIDER_ORDER.slice(
        ANIME_SCRAPE_PROVIDER_ORDER.length,
      ),
    ).toEqual([...TMDB_SCRAPE_PROVIDER_ORDER]);
  });
});
