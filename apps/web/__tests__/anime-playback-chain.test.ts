import { describe, expect, it } from "vitest";

import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  TMDB_SCRAPE_PROVIDER_ORDER,
} from "@/lib/providers/registry";
import {
  buildAnimePlaybackProviderOrder,
  buildGroupedAnimePlaybackProviderOptions,
  shouldIncludeTmdbPlaybackProxies,
  withManualDirectMenuOption,
  type AnimePlaybackChainContext,
} from "@/lib/providers/anime-playback-chain";
import { shouldIncludeHentaigasmForGenres } from "@/lib/scrape/anime/hentaigasm-eligible";

const filterAnimeProvidersForTest = (context: AnimePlaybackChainContext) =>
  ANIME_SCRAPE_PROVIDER_ORDER.filter((providerId) => {
    if (providerId === "hentaigasm" || providerId === "anipm") {
      return shouldIncludeHentaigasmForGenres(
        context.isAdultAnime,
        context.anilistGenres ?? [],
      );
    }

    return true;
  });

describe("anime-playback-chain", () => {
  it("includes TMDB proxies for every high-confidence mapping", () => {
    expect(
      shouldIncludeTmdbPlaybackProxies({
        mappingConfidence: "high",
        isAdultAnime: false,
      }),
    ).toBe(true);

    expect(
      shouldIncludeTmdbPlaybackProxies({
        mappingConfidence: "low",
        isAdultAnime: false,
      }),
    ).toBe(false);

    expect(
      shouldIncludeTmdbPlaybackProxies({
        mappingConfidence: "high",
        isAdultAnime: true,
      }),
    ).toBe(false);
  });

  it("builds anime-only provider order for low-confidence shows", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "low",
      isAdultAnime: true,
    });

    expect(order).toContain("hentaigasm");
    expect(order).not.toContain("direct");
    expect(order).not.toContain("hentaini");
    expect(order).not.toContain("animepahe");
    expect(order).not.toContain("anikuro");
    expect(order).not.toEqual(
      expect.arrayContaining([...TMDB_SCRAPE_PROVIDER_ORDER]),
    );
  });

  it("skips TMDB proxies for adult anime even with high-confidence mapping", () => {
    expect(
      shouldIncludeTmdbPlaybackProxies({
        mappingConfidence: "high",
        isAdultAnime: true,
      }),
    ).toBe(false);
  });

  it("puts adult providers first and omits mainstream providers for adult", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "high",
      isAdultAnime: true,
      anilistGenres: ["Hentai"],
    });

    expect(order[0]).toBe("hentaigasm");
    expect(order[1]).toBe("anipm");
    expect(order).not.toContain("direct");
    expect(order).not.toContain("animegg");
    expect(order).not.toContain("animepahe");
    expect(order).not.toContain("hentaini");
    expect(order).not.toEqual(
      expect.arrayContaining([...TMDB_SCRAPE_PROVIDER_ORDER]),
    );
  });

  it("omits hentaigasm for non-adult shows without the Hentai genre", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "low",
      isAdultAnime: false,
      anilistGenres: ["Action", "Romance"],
    });

    expect(order).not.toContain("hentaigasm");
    expect(order).not.toContain("anipm");
    expect(order).toContain("animegg");
    expect(order).not.toContain("animepahe");
    expect(order).not.toContain("anikuro");
  });

  it("includes hentaigasm first when the Hentai genre is present", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "low",
      isAdultAnime: false,
      anilistGenres: ["Hentai", "Romance"],
    });

    expect(order[0]).toBe("hentaigasm");
    expect(order[1]).toBe("anipm");
    expect(order).not.toContain("animegg");
    expect(order).not.toContain("animepahe");
    expect(order).not.toContain("hentaini");
  });

  it("keeps multi-audio AniZone and omits sub-only AnimeOnsen for dub playback", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "low",
      isAdultAnime: false,
      anilistGenres: ["Action"],
      translationType: "dub",
    });

    expect(order).toContain("anizone");
    expect(order).not.toContain("animeonsen");
    expect(order).toEqual([
      "kickassanime",
      "anizone",
      "allmanga",
      "animegg",
      "kyren",
      "justanime",
    ]);
  });

  it("defers Direct until after all anime scrapers when dub is selected", () => {
    const context = {
      mappingConfidence: "high" as const,
      isAdultAnime: false,
      anilistGenres: ["Action"],
      translationType: "dub" as const,
    };
    const order = buildAnimePlaybackProviderOrder(context);
    const animeProviders = filterAnimeProvidersForTest(context).filter(
      (providerId) => providerId !== "animeonsen",
    );
    const tmdbWithoutDirect = TMDB_SCRAPE_PROVIDER_ORDER.filter(
      (providerId) => providerId !== "direct",
    );

    expect(order.slice(0, animeProviders.length)).toEqual(animeProviders);
    expect(order[animeProviders.length]).toBe("direct");
    expect(order.slice(animeProviders.length + 1)).toEqual(tmdbWithoutDirect);
    expect(order.indexOf("kickassanime")).toBeLessThan(order.indexOf("direct"));
  });

  it("races all anime scrapers before Direct for high-confidence shows", () => {
    const context = {
      mappingConfidence: "high" as const,
      isAdultAnime: false,
      anilistGenres: ["Action"],
    };
    const order = buildAnimePlaybackProviderOrder(context);
    const animeProviders = filterAnimeProvidersForTest(context);
    const tmdbWithoutDirect = TMDB_SCRAPE_PROVIDER_ORDER.filter(
      (providerId) => providerId !== "direct",
    );

    expect(order.slice(0, animeProviders.length)).toEqual(animeProviders);
    expect(order[animeProviders.length]).toBe("direct");
    expect(order.slice(animeProviders.length + 1)).toEqual(tmdbWithoutDirect);
    expect(order.indexOf("kickassanime")).toBeLessThan(order.indexOf("direct"));
  });

  it("still places Direct before other TMDB scrapers when menu order puts it last", () => {
    const order = buildAnimePlaybackProviderOrder(
      {
        mappingConfidence: "high",
        isAdultAnime: false,
        anilistGenres: ["Action"],
      },
      {
        tmdbOrder: ["bingr", "videasy", "direct"],
      },
    );

    const animeProviders = filterAnimeProvidersForTest({
      mappingConfidence: "high",
      isAdultAnime: false,
      anilistGenres: ["Action"],
    });

    expect(order.slice(0, animeProviders.length)).toEqual(animeProviders);
    expect(order[animeProviders.length]).toBe("direct");
    expect(order).toContain("bingr");
    expect(order.indexOf("direct")).toBeLessThan(order.indexOf("bingr"));
  });

  it("groups provider options for the server selector", () => {
    const context = {
      mappingConfidence: "high" as const,
      isAdultAnime: false,
      anilistGenres: ["Action"],
    };
    const grouped = buildGroupedAnimePlaybackProviderOptions(context);
    const animeProviders = filterAnimeProvidersForTest(context);

    const animeCount = grouped.filter(
      (entry) => entry.group === "anime",
    ).length;
    const tmdbCount = grouped.filter((entry) => entry.group === "tmdb").length;

    expect(animeCount).toBe(animeProviders.length);
    expect(tmdbCount).toBe(TMDB_SCRAPE_PROVIDER_ORDER.length);
    expect(grouped.slice(0, 3).map((entry) => entry.providerId)).toEqual([
      animeProviders[0],
      animeProviders[1],
      animeProviders[2],
    ]);
    expect(grouped[0]?.group).toBe("anime");
  });

  it("groups adult options without mainstream-only providers", () => {
    const grouped = buildGroupedAnimePlaybackProviderOptions({
      mappingConfidence: "low",
      isAdultAnime: true,
      anilistGenres: ["Hentai"],
    });

    expect(grouped.map((entry) => entry.providerId)).toEqual([
      "hentaigasm",
      "anipm",
      "kickassanime",
      "anizone",
      "allmanga",
      "animeonsen",
      "kyren",
      "justanime",
    ]);
  });

  it("appends Direct to the menu when it is missing from the chain", () => {
    const grouped = buildGroupedAnimePlaybackProviderOptions({
      mappingConfidence: "low",
      isAdultAnime: false,
      anilistGenres: ["Action"],
    });

    const withDirect = withManualDirectMenuOption(grouped, true);

    expect(withDirect[0]?.providerId).not.toBe("direct");
    expect(withDirect.at(-1)).toEqual({
      providerId: "direct",
      name: "Direct",
      group: "tmdb",
    });
    expect(
      withManualDirectMenuOption(withDirect, true).filter(
        (option) => option.providerId === "direct",
      ),
    ).toHaveLength(1);
  });
});
