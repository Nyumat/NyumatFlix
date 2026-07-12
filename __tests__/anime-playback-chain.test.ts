import { describe, expect, it } from "vitest";

import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  TMDB_SCRAPE_PROVIDER_ORDER,
} from "@/lib/providers/registry";
import {
  buildAnimePlaybackProviderOrder,
  buildGroupedAnimePlaybackProviderOptions,
  shouldIncludeTmdbPlaybackProxies,
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
    ).toBe(true);
  });

  it("builds anime-only provider order for low-confidence shows", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "low",
      isAdultAnime: true,
    });

    expect(order).toContain("hentaigasm");
    expect(order).not.toEqual(
      expect.arrayContaining([...TMDB_SCRAPE_PROVIDER_ORDER]),
    );
  });

  it("puts hentaigasm and anipm first and omits mainstream providers for adult", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "high",
      isAdultAnime: true,
      anilistGenres: ["Hentai"],
    });

    expect(order[0]).toBe("hentaigasm");
    expect(order[1]).toBe("anipm");
    expect(order).not.toContain("animegg");
    expect(order).not.toContain("animepahe");
    expect(order).toEqual(
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
    expect(order[1]).toBe("anipm");
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
      "anikitty",
      "animeparadise",
      "kyren",
      "anikuro",
      "allmanga",
      "animegg",
      "kickassanime",
      "anizone",
      "animestream",
      "animepahe",
    ]);
  });

  it("appends TMDB proxies for high-confidence non-adult shows", () => {
    const context = {
      mappingConfidence: "high" as const,
      isAdultAnime: false,
      anilistGenres: ["Action"],
    };
    const order = buildAnimePlaybackProviderOrder(context);
    const animeProviders = filterAnimeProvidersForTest(context);

    expect(order.slice(0, animeProviders.length)).toEqual(animeProviders);
    expect(order.slice(animeProviders.length)).toEqual(
      TMDB_SCRAPE_PROVIDER_ORDER,
    );
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
      "justanime",
      "anikitty",
      "animeparadise",
      "kyren",
      "anikuro",
      "animeonsen",
      "allmanga",
      "kickassanime",
      "anizone",
      "animestream",
    ]);
  });
});
