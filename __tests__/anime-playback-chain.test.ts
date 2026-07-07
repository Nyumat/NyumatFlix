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
  it("includes TMDB proxies only for high-confidence non-adult mappings", () => {
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

  it("builds anime-only provider order for adult or low-confidence shows", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "low",
      isAdultAnime: true,
    });

    expect(order).toContain("hentaigasm");
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
  });

  it("includes hentaigasm when the Hentai genre is present", () => {
    const order = buildAnimePlaybackProviderOrder({
      mappingConfidence: "low",
      isAdultAnime: false,
      anilistGenres: ["Hentai", "Romance"],
    });

    expect(order).toContain("hentaigasm");
    expect(order).toContain("anipm");
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
    expect(order).toEqual(["anizone", "kickassanime", "animegg", "animepahe"]);
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
});
