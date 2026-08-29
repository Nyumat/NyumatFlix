import { afterEach, describe, expect, it } from "vitest";

import { scrapePreferProxyHostname } from "@/lib/scrape/fetch";
import { classifyVidKingSource } from "@/lib/scrape/providers/vidking";
import {
  VIDEASY_PLAYER_ORIGIN,
  VIDKING_PLAYER_ORIGIN,
  WINGS_API_BASE,
  WINGS_API_HOSTNAME,
  isWingsApiHostname,
  wingsApiHeaders,
  wingsSeedUrl,
  wingsSourceUrl,
} from "@/lib/scrape/vidking-constants";
import { scrapeRateLimitRotateHostname } from "@/lib/scrape/vpn-rotate";
import { resetWingsApiDiscoverState } from "@/lib/scrape/wings-api-discover";

afterEach(() => {
  resetWingsApiDiscoverState();
});

describe("wings API URL builders", () => {
  it("points seed and sources at speedracelight, not wingsdatabase", () => {
    expect(WINGS_API_BASE).toBe("https://api.speedracelight.com");
    expect(wingsSeedUrl(550)).toBe(
      "https://api.speedracelight.com/seed?mediaId=550",
    );
    expect(wingsSeedUrl(550)).not.toContain("wingsdatabase");
    expect(WINGS_API_HOSTNAME).toBe("api.speedracelight.com");
    expect(isWingsApiHostname("api.speedracelight.com")).toBe(true);
    expect(scrapePreferProxyHostname(WINGS_API_HOSTNAME)).toBe(true);
    expect(scrapeRateLimitRotateHostname(WINGS_API_HOSTNAME)).toBe(true);
  });

  it("encodes source query params once via URLSearchParams", () => {
    const url = wingsSourceUrl("cdn/sources-with-title", {
      title: "Fight Club",
      mediaType: "movie",
      year: "1999",
      tmdbId: 550,
      imdbId: "tt0137523",
      seasonId: "1",
      episodeId: "1",
      seed: "59564445.abc",
    });
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://api.speedracelight.com");
    expect(parsed.pathname).toBe("/cdn/sources-with-title");
    expect(parsed.searchParams.get("title")).toBe("Fight Club");
    expect(parsed.searchParams.get("enc")).toBe("2");
    expect(parsed.searchParams.get("tmdbId")).toBe("550");
    expect(parsed.searchParams.get("seed")).toBe("59564445.abc");
  });

  it("uses seasonId/episodeId for TV queries", () => {
    const url = wingsSourceUrl("vsrc/sources-with-title", {
      title: "Breaking Bad",
      mediaType: "tv",
      year: "2008",
      tmdbId: 1396,
      imdbId: "tt0903747",
      seasonId: "1",
      episodeId: "1",
      seed: "seed",
    });
    const parsed = new URL(url);

    expect(parsed.searchParams.get("mediaType")).toBe("tv");
    expect(parsed.searchParams.get("seasonId")).toBe("1");
    expect(parsed.searchParams.get("episodeId")).toBe("1");
    expect(parsed.searchParams.get("season")).toBeNull();
    expect(parsed.searchParams.get("episode")).toBeNull();
  });

  it("sends player Origin/Referer plus no-cache headers", () => {
    expect(wingsApiHeaders(VIDEASY_PLAYER_ORIGIN)).toEqual({
      Origin: "https://player.videasy.to",
      Referer: "https://player.videasy.to/",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    expect(wingsApiHeaders(`${VIDKING_PLAYER_ORIGIN}/`)).toMatchObject({
      Origin: "https://www.vidking.net",
      Referer: "https://www.vidking.net/",
    });
  });

  it("classifies speedracelight index-s1080p playlists as variants", () => {
    expect(
      classifyVidKingSource(
        "https://moon.peakstorm.top/vd/token/index-s1080p-v1-a1.m3u8",
        "1080p",
      ),
    ).toBe("variant");
    expect(
      classifyVidKingSource(
        "https://moon.peakstorm.top/vd/token/index-s720p-v1-a1.m3u8",
      ),
    ).toBe("variant");
  });
});
