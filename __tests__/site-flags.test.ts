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
      filterAnimeScrapeProviderIds(flags, ["anizone", "animepahe"]),
    ).toEqual(["animepahe"]);
  });

  it("returns compile-time defaults when resolving empty raw state", () => {
    const defaults = getDefaultSiteFlags();
    expect(defaults.liveTvEnabled).toBe(false);
    expect(defaults.authEnabled).toBe(true);
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
});
