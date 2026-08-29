import { describe, expect, it } from "vitest";

import { DEFAULT_FLAG_VALUES } from "@/lib/flags/flag-catalog";
import {
  filterAnimeScrapeProviderIds,
  filterEmbedProviderIds,
  filterTmdbScrapeProviderIds,
  getDefaultSiteFlags,
  getPlaybackModePolicy,
  resolveSiteFlags,
} from "@/lib/flags/site-flags";

describe("site-flags", () => {
  it("derives iframe lock off when proxy mode is forced", () => {
    const flags = resolveSiteFlags({
      ...DEFAULT_FLAG_VALUES,
      "global.proxy_mode_only": true,
      "global.iframe_mode_only": true,
    });

    expect(flags.proxyModeOnly).toBe(true);
    expect(flags.iframeModeOnly).toBe(false);
    expect(flags.locks.playbackMode).toBe(true);
  });

  it("filters disabled embed and scrape providers", () => {
    const flags = resolveSiteFlags({
      ...DEFAULT_FLAG_VALUES,
      "provider.embed.vidsrc.enabled": false,
      "provider.scrape.tmdb.vidking.enabled": false,
      "provider.scrape.anime.anizone.enabled": false,
    });

    expect(filterEmbedProviderIds(flags, ["vidsrc", "2embed"])).toEqual([
      "2embed",
    ]);
    expect(filterTmdbScrapeProviderIds(flags, ["vidking", "vidsrc"])).toEqual([
      "vidsrc",
    ]);
    expect(
      filterAnimeScrapeProviderIds(flags, ["anizone", "justanime"]),
    ).toEqual(["justanime"]);
  });

  it("keeps direct in scrape order when server resolved it as available", () => {
    const flags = {
      ...getDefaultSiteFlags(),
      directScrapeProviderAvailable: true,
      tmdbScrapeProviders: {
        ...getDefaultSiteFlags().tmdbScrapeProviders,
        direct: true,
        vidking: false,
        vidsrc: false,
      },
    };

    expect(filterTmdbScrapeProviderIds(flags, ["direct", "vidking"])).toEqual([
      "direct",
    ]);
  });

  it("drops direct from scrape order when server resolved it as unavailable", () => {
    const flags = {
      ...getDefaultSiteFlags(),
      directScrapeProviderAvailable: false,
      tmdbScrapeProviders: {
        ...getDefaultSiteFlags().tmdbScrapeProviders,
        direct: true,
      },
    };

    expect(filterTmdbScrapeProviderIds(flags, ["direct", "vidsrc"])).toEqual([
      "vidsrc",
    ]);
  });

  it("returns compile-time defaults when resolving empty raw state", () => {
    const defaults = getDefaultSiteFlags();
    expect(defaults.liveTvEnabled).toBe(false);
    expect(defaults.authEnabled).toBe(true);
    expect(defaults.announcementBanner.enabled).toBe(false);
    expect(getPlaybackModePolicy(defaults)).toBe("choice");
  });

  it("maps playback policies from global toggles", () => {
    expect(
      getPlaybackModePolicy(
        resolveSiteFlags({
          ...DEFAULT_FLAG_VALUES,
          "global.proxy_mode_only": true,
        }),
      ),
    ).toBe("proxy");

    expect(
      getPlaybackModePolicy(
        resolveSiteFlags({
          ...DEFAULT_FLAG_VALUES,
          "global.iframe_mode_only": true,
        }),
      ),
    ).toBe("iframe");
  });

  it("resolves default proxy playback without forcing iframe lock", () => {
    const flags = resolveSiteFlags({
      ...DEFAULT_FLAG_VALUES,
      "global.default_proxy_playback": true,
    });

    expect(flags.defaultProxyPlayback).toBe(true);
    expect(flags.proxyModeOnly).toBe(false);
    expect(flags.locks.playbackMode).toBe(false);
    expect(getPlaybackModePolicy(flags)).toBe("choice");
  });
});
