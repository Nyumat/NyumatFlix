import { describe, expect, it } from "vitest";

import {
  normalizeVidKingAssetHost,
  parseVidKingCdnUrl,
  rebuildVidKingCdnUrl,
  swapVidKingCdnToken,
} from "@/lib/scrape/vidking-cdn-url";
import {
  VIDKING_PROACTIVE_REFRESH_AFTER_MS,
  VIDKING_REFRESH_BEFORE_MS,
  VIDKING_SEED_TTL_MS,
} from "@/lib/scrape/vidking-constants";

describe("vidking-playback", () => {
  const sampleUrl =
    "https://shadowlemon.site/r2/cdn2/abc123token/720p/index.m3u8";

  it("parses shadowlemon cdn2 variant URLs", () => {
    expect(parseVidKingCdnUrl(sampleUrl)).toEqual({
      prefix: "https://shadowlemon.site/r2/cdn2",
      token: "abc123token",
      pathAfterToken: "720p/index.m3u8",
    });
  });

  it("parses cdn1 flat playlists", () => {
    const flat = "https://shadowlemon.site/r2/cdn1/flat-token/playlist.m3u8";

    expect(parseVidKingCdnUrl(flat)).toEqual({
      prefix: "https://shadowlemon.site/r2/cdn1",
      token: "flat-token",
      pathAfterToken: "playlist.m3u8",
    });
  });

  it("swaps CDN tokens while preserving quality path", () => {
    const swapped = swapVidKingCdnToken(sampleUrl, "fresh-token");

    expect(swapped).toBe(
      "https://shadowlemon.site/r2/cdn2/fresh-token/720p/index.m3u8",
    );
  });

  it("moves rotated asset hosts to the working playlist origin", () => {
    expect(
      normalizeVidKingAssetHost(
        "https://stale.example/r2/cdn2/shared-token/1080p/a.jpg",
        "https://working.example/r2/cdn2/shared-token/1080p/index.m3u8",
      ),
    ).toBe("https://working.example/r2/cdn2/shared-token/1080p/a.jpg");
  });

  it("does not move unrelated tokens or non-HTTPS assets", () => {
    const playlist =
      "https://working.example/r2/cdn2/expected/1080p/index.m3u8";

    expect(
      normalizeVidKingAssetHost(
        "https://stale.example/r2/cdn2/different/1080p/a.jpg",
        playlist,
      ),
    ).toBe("https://stale.example/r2/cdn2/different/1080p/a.jpg");
    expect(
      normalizeVidKingAssetHost(
        "http://stale.example/r2/cdn2/expected/1080p/a.jpg",
        playlist,
      ),
    ).toBe("http://stale.example/r2/cdn2/expected/1080p/a.jpg");
  });

  it("rebuilds URLs from parsed parts", () => {
    const parsed = parseVidKingCdnUrl(sampleUrl);
    expect(parsed).not.toBeNull();

    if (!parsed) {
      return;
    }

    expect(rebuildVidKingCdnUrl(parsed, "next-token")).toBe(
      "https://shadowlemon.site/r2/cdn2/next-token/720p/index.m3u8",
    );
  });

  it("refreshes before the 30s seed TTL expires", () => {
    expect(VIDKING_REFRESH_BEFORE_MS).toBeLessThan(VIDKING_SEED_TTL_MS);
    expect(VIDKING_SEED_TTL_MS - VIDKING_REFRESH_BEFORE_MS).toBe(5_000);
  });

  it("starts proactive refresh before the hard refresh window", () => {
    expect(VIDKING_PROACTIVE_REFRESH_AFTER_MS).toBeLessThan(
      VIDKING_REFRESH_BEFORE_MS,
    );
  });
});
