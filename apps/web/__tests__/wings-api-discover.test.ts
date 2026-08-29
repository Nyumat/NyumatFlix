import { afterEach, describe, expect, it } from "vitest";

import { scrapePreferProxyHostname } from "@/lib/scrape/fetch";
import {
  getVideasyPlayerOrigin,
  getWingsApiBase,
  getWingsCdnReferers,
  isWingsApiHostname,
  wingsSeedUrl,
  wingsSourceUrl,
} from "@/lib/scrape/vidking-constants";
import { scrapeRateLimitRotateHostname } from "@/lib/scrape/vpn-rotate";
import {
  defaultWingsPlayerOriginCandidates,
  expandPlayerOriginCandidates,
  extractPlayerOriginsFromSource,
  extractScriptSrcs,
  extractWingsApiBases,
  resetWingsApiDiscoverState,
  scoreWingsApiBase,
} from "@/lib/scrape/wings-api-discover";
import {
  registerWingsApiHostname,
  setWingsApiRuntime,
} from "@/lib/scrape/wings-api-runtime";

afterEach(() => {
  resetWingsApiDiscoverState();
});

describe("wings player origin candidates", () => {
  it("expands .net player hosts to .to siblings", () => {
    const videasy = expandPlayerOriginCandidates("https://player.videasy.net");
    expect(videasy[0]).toBe("https://player.videasy.net");
    expect(videasy).toContain("https://player.videasy.to");
    expect(videasy).toContain("https://player.videasy.com");

    const vidking = expandPlayerOriginCandidates("https://www.vidking.net");
    expect(vidking).toContain("https://www.vidking.to");
    expect(vidking).toContain("https://vidking.net");
    expect(vidking).toContain("https://vidking.to");
  });

  it("includes historical Videasy and VidKing origins", () => {
    expect(defaultWingsPlayerOriginCandidates("videasy")).toEqual(
      expect.arrayContaining([
        "https://player.videasy.to",
        "https://player.videasy.net",
      ]),
    );
    expect(defaultWingsPlayerOriginCandidates("vidking")).toEqual(
      expect.arrayContaining([
        "https://www.vidking.net",
        "https://vidking.net",
        "https://www.vidking.to",
      ]),
    );
  });
});

describe("wings player bundle parsers", () => {
  it("extracts api.* hosts near seed/sources and ignores decoys", () => {
    const source = [
      'let E="https://api.speedracelight.com";',
      'fetch(E + "/seed?mediaId=" + id)',
      'E + "/cdn/sources-with-title"',
      "https://api.themoviedb.org/3/movie/550",
      "https://api.wingsdatabase.com/seed",
      `${"x".repeat(400)}https://api.peakstorm.top/cdn`,
    ].join("\n");

    expect(extractWingsApiBases(source)).toEqual([
      "https://api.speedracelight.com",
      "https://api.peakstorm.top",
    ]);
    expect(
      extractWingsApiBases('let E="https:\\/\\/api.speedracelight.com"'),
    ).toEqual(["https://api.speedracelight.com"]);
    expect(
      scoreWingsApiBase(source, "https://api.speedracelight.com"),
    ).toBeGreaterThan(scoreWingsApiBase(source, "https://api.peakstorm.top"));
  });

  it("extracts moved player origins and script srcs", () => {
    expect(
      extractPlayerOriginsFromSource(
        'origin:"https://player.videasy.to"; fallback:"https://www.vidking.net"',
      ),
    ).toEqual(["https://player.videasy.to", "https://www.vidking.net"]);

    expect(
      extractScriptSrcs(
        '<script src="/_next/static/chunks/app.js"></script>',
        "https://player.videasy.to/movie/550",
      ),
    ).toEqual(["https://player.videasy.to/_next/static/chunks/app.js"]);
  });
});

describe("wings runtime cache", () => {
  it("routes seed/source URLs and proxy/429 through a discovered API host", () => {
    setWingsApiRuntime({
      apiBase: "https://api.example-wings.test",
      videasyPlayerOrigin: "https://player.videasy.cc",
      vidkingPlayerOrigin: "https://www.vidking.to",
      discoveredAt: Date.now(),
    });

    expect(getWingsApiBase()).toBe("https://api.example-wings.test");
    expect(getVideasyPlayerOrigin()).toBe("https://player.videasy.cc");
    expect(wingsSeedUrl(550)).toBe(
      "https://api.example-wings.test/seed?mediaId=550",
    );
    expect(
      new URL(
        wingsSourceUrl("cdn/sources-with-title", {
          title: "Fight Club",
          mediaType: "movie",
          year: "1999",
          tmdbId: 550,
          imdbId: "tt0137523",
          seasonId: "1",
          episodeId: "1",
          seed: "seed",
        }),
      ).origin,
    ).toBe("https://api.example-wings.test");
    expect(isWingsApiHostname("api.example-wings.test")).toBe(true);
    expect(scrapePreferProxyHostname("api.example-wings.test")).toBe(true);
    expect(scrapeRateLimitRotateHostname("api.example-wings.test")).toBe(true);
    expect(getWingsCdnReferers()).toContain("https://player.videasy.cc/");
    expect(getWingsCdnReferers()[0]).toBe("https://www.vidking.to/");
  });

  it("registers a hostname before the next seed probe would run", () => {
    registerWingsApiHostname("api.future-wings.test");
    expect(isWingsApiHostname("api.future-wings.test")).toBe(true);
    expect(scrapePreferProxyHostname("api.future-wings.test")).toBe(true);
  });
});
