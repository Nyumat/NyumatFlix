import { describe, expect, it } from "vitest";

import {
  buildXPassEmbedPath,
  extractXPassPlaylistPath,
  extractXPassPlaylistPaths,
  XPASS_PLAYABLE_CANDIDATE_BATCH,
  XPASS_PLAYABLE_CANDIDATE_LIMIT,
} from "@/lib/scrape/providers/xpass";
import {
  extractXPassDataUrl,
  isValidXPassDataToken,
  playlistPathsFromXPassBackups,
} from "@/lib/scrape/xpass-data";

const movieEmbedHtml = `
<script>var data={"width":"100%","height":"100%","playlist":"/mvid/Qn9K2Vc9YXHhNxZScAiVgM/1/playlist.json","tracks":[],"autostart":true,"cast":{}}</script>
`;

const tvEmbedHtml = `
<script>var data={"width":"100%","height":"100%","playlist":"/vip/eCtFSdaW_HaR24t_oRvFCDnvooJnqXKE4oPR23k8UdZQq4h3--Bsc3EMDqmh4vyZmQ2PM5doPf88oj7C4Bb3BJPGQg/1/playlist.json","tracks":[],"autostart":true,"cast":{}}</script>
<script>var backups=[{"id":"","name":"MEG 1","url":"/meg/tv/46298/1/52/1/playlist.json","dl":true}]</script>
`;

const dynamicEmbedHtml = `
<script>var data={"width":"100%","height":"100%","playlist":"","tracks":[],"autostart":true,"cast":{}}</script>
<script>var dataUrl="/data/movie/550?autostart=true&token=abc";</script>
<script>var backups=[]</script>
`;

const encodeXPassTokenPayload = (payload: string): string =>
  Buffer.from(payload, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const buildXPassDataToken = (options: {
  embedContext: string;
  dataPathname?: string;
  expiresInSeconds?: number;
}): string => {
  const expires =
    Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 120);
  const payload = [
    "v2",
    "play.xpass.top",
    options.embedContext,
    options.dataPathname ?? "/data/movie/550",
    "movie",
    "550",
    "0",
    "0",
    String(expires),
    "test-salt",
  ].join("|");

  return `${encodeXPassTokenPayload(payload)}.${"0".repeat(64)}`;
};

describe("buildXPassEmbedPath", () => {
  it("uses IMDB ids for movies", () => {
    expect(
      buildXPassEmbedPath({ mediaType: "movie", tmdbId: 550 }, "tt0137523"),
    ).toBe("e/movie/tt0137523?autostart=true");
  });

  it("uses TMDB ids for TV so niche anime does not resolve to tmdb 0", () => {
    expect(
      buildXPassEmbedPath(
        {
          mediaType: "tv",
          tmdbId: 70590,
          seasonNumber: 1,
          episodeNumber: 1,
        },
        "tt6768600",
      ),
    ).toBe("e/tv/70590/1/1?autostart=true");
  });

  it("defaults missing TV season and episode to 1", () => {
    expect(buildXPassEmbedPath({ mediaType: "tv", tmdbId: 64396 }, null)).toBe(
      "e/tv/64396/1/1?autostart=true",
    );
  });
});

describe("extractXPassPlaylistPath", () => {
  it("extracts mvid playlist paths from movie embed pages", () => {
    expect(extractXPassPlaylistPath(movieEmbedHtml)).toBe(
      "mvid/Qn9K2Vc9YXHhNxZScAiVgM/1/playlist.json",
    );
  });

  it("extracts vip playlist paths from tv embed pages", () => {
    expect(extractXPassPlaylistPath(tvEmbedHtml)).toBe(
      "vip/eCtFSdaW_HaR24t_oRvFCDnvooJnqXKE4oPR23k8UdZQq4h3--Bsc3EMDqmh4vyZmQ2PM5doPf88oj7C4Bb3BJPGQg/1/playlist.json",
    );
  });

  it("falls back to meg/tv paths when playlist json is absent", () => {
    const html = `{"url":"/meg/tv/46298/1/52/1/playlist.json"}`;
    expect(extractXPassPlaylistPath(html)).toBe(
      "meg/tv/46298/1/52/1/playlist.json",
    );
  });

  it("returns null when no playlist path is present", () => {
    expect(extractXPassPlaylistPath("<html></html>")).toBeNull();
  });

  it("ignores empty playlist fields from dynamic XPass embeds", () => {
    expect(extractXPassPlaylistPath(dynamicEmbedHtml)).toBeNull();
    expect(extractXPassPlaylistPaths(dynamicEmbedHtml)).toEqual([]);
    expect(extractXPassDataUrl(dynamicEmbedHtml)).toBe(
      "/data/movie/550?autostart=true&token=abc",
    );
  });

  it("maps decrypted backup servers to playlist paths", () => {
    expect(
      playlistPathsFromXPassBackups([
        { url: "/mdata/server-a/1/playlist.json" },
        { url: "/mdata/server-a/1/playlist.json" },
        { url: "/vip/server-b/1/playlist.json" },
      ]),
    ).toEqual([
      "mdata/server-a/1/playlist.json",
      "vip/server-b/1/playlist.json",
    ]);
  });

  it("validates XPass data tokens bound to embed context", () => {
    const embedContext =
      "https://play.xpass.top/e/movie/tt0137523?autostart=true";
    const token = buildXPassDataToken({ embedContext });

    expect(
      isValidXPassDataToken(
        token,
        "play.xpass.top",
        "/data/movie/550",
        embedContext,
      ),
    ).toBe(true);

    expect(
      isValidXPassDataToken(
        token,
        "play.xpass.top",
        "/data/movie/550",
        "https://play.xpass.top/e/movie/tt9999999?autostart=true",
      ),
    ).toBe(false);
  });

  it("collects primary and backup playlist paths", () => {
    expect(extractXPassPlaylistPaths(tvEmbedHtml)).toEqual([
      "vip/eCtFSdaW_HaR24t_oRvFCDnvooJnqXKE4oPR23k8UdZQq4h3--Bsc3EMDqmh4vyZmQ2PM5doPf88oj7C4Bb3BJPGQg/1/playlist.json",
      "meg/tv/46298/1/52/1/playlist.json",
    ]);
  });

  it("races the first two ranked sources", () => {
    expect(XPASS_PLAYABLE_CANDIDATE_LIMIT).toBe(2);
    expect(XPASS_PLAYABLE_CANDIDATE_BATCH).toBe(2);
  });
});
