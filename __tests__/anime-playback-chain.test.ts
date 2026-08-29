import { describe, expect, it } from "vitest";

import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  TMDB_SCRAPE_PROVIDER_ORDER,
} from "@/lib/providers/registry";
import {
  ANIME_DIRECT_RACE_LEAD,
  buildAnimePlaybackProviderOrder,
  buildGroupedAnimePlaybackProviderOptions,
  shouldIncludeTmdbPlaybackProxies,
  withManualDirectMenuOption,
  type AnimePlaybackChainContext,
} from "@/lib/providers/anime-playback-chain";
import { shouldIncludeHentaigasmForGenres } from "@/lib/scrape/anime/hentaigasm-eligible";

const filterAnimeProvidersForTest = (context: AnimePlaybackChainContext) =>
  ANIME_SCRAPE_PROVIDER_ORDER.filter((providerId) => {
    if (
      providerId === "hentaigasm" ||
      providerId === "hentaini" ||
      providerId === "anipm"
    ) {
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
    expect(order[1]).toBe("hentaini");
    expect(order[2]).toBe("anipm");
    expect(order).not.toContain("direct");
    expect(order).not.toContain("animegg");
    expect(order).not.toContain("animepahe");
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
    expect(order).toContain("animepahe");
  });

  it("includes hentaigasm first when the Hentai genre is present", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "low",
      isAdultAnime: false,
      anilistGenres: ["Hentai", "Romance"],
    });

    expect(order[0]).toBe("hentaigasm");
    expect(order[1]).toBe("hentaini");
    expect(order[2]).toBe("anipm");
    expect(order).not.toContain("animegg");
    expect(order).not.toContain("animepahe");
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
      "justanime",
      "kyren",
      "allmanga",
      "animegg",
      "kickassanime",
      "anizone",
      "animestream",
      "animepahe",
      "anikuro",
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

  it("races Direct after the first two anime scrapers for high-confidence shows", () => {
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

    expect(order.slice(0, ANIME_DIRECT_RACE_LEAD + 1)).toEqual([
      animeProviders[0],
      animeProviders[1],
      "direct",
    ]);
    expect(
      order.slice(ANIME_DIRECT_RACE_LEAD + 1, animeProviders.length + 1),
    ).toEqual(animeProviders.slice(ANIME_DIRECT_RACE_LEAD));
    expect(order.slice(animeProviders.length + 1)).toEqual(tmdbWithoutDirect);
  });

  it("still races Direct first among TMDB even if menu order puts it last", () => {
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

    expect(order.slice(0, 3)).toEqual(["justanime", "kyren", "direct"]);
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
      "direct",
    ]);
    expect(grouped[2]?.group).toBe("tmdb");
  });

  it("groups adult options without mainstream-only providers", () => {
    const grouped = buildGroupedAnimePlaybackProviderOptions({
      mappingConfidence: "low",
      isAdultAnime: true,
      anilistGenres: ["Hentai"],
    });

    expect(grouped.map((entry) => entry.providerId)).toEqual([
      "hentaigasm",
      "hentaini",
      "anipm",
      "justanime",
      "kyren",
      "animeonsen",
      "allmanga",
      "kickassanime",
      "anizone",
      "animestream",
      "anikuro",
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
