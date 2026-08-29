import { describe, expect, it } from "vitest";

import {
  buildVixsrcPlaylistUrl,
  extractVixsrcPlaylistParams,
  isVixsrcPlaylistUrl,
} from "@/lib/scrape/vixsrc-shared";
import {
  buildVixsrcApiUrl,
  buildVixsrcPageUrl,
  isVixsrcCloudflareIpBan,
  parseVixsrcApiBody,
  rewriteVixsrcFlareSolverrProxyUrl,
} from "@/lib/scrape/providers/vixsrc";
import {
  VIXSRC_PROACTIVE_REFRESH_AFTER_MS,
  VIXSRC_REFRESH_BEFORE_MS,
  VIXSRC_PLAYLIST_TTL_MS,
} from "@/lib/scrape/vixsrc-constants";
import { isMegaplayMasterPlaybackUrl } from "@/lib/scrape/megaplay-playback";
import type { MegaplayPlaybackRefresh } from "@/lib/scrape/megaplay-constants";

describe("vixsrc shared helpers", () => {
  const embedHtml = `
    window.video = { id: '170060' };
    window.masterPlaylist = { 'token': 'abc123', 'expires': '1783278000' };
  `;

  it("extracts playlist params from embed HTML", () => {
    expect(extractVixsrcPlaylistParams(embedHtml)).toEqual({
      videoId: "170060",
      token: "abc123",
      expires: "1783278000",
    });
  });

  it("builds playlist URLs with token and expires", () => {
    expect(
      buildVixsrcPlaylistUrl({
        videoId: "170060",
        token: "abc123",
        expires: "1783278000",
      }),
    ).toBe(
      "https://vixsrc.to/playlist/170060?token=abc123&expires=1783278000&h=1",
    );
    expect(
      buildVixsrcPlaylistUrl(
        {
          videoId: "170060",
          token: "abc123",
          expires: "1783278000",
        },
        "https://vixcloud.co",
      ),
    ).toBe(
      "https://vixcloud.co/playlist/170060?token=abc123&expires=1783278000&h=1",
    );
  });

  it("detects VixSrc playlist URLs", () => {
    const url = "https://vixsrc.to/playlist/170060?token=abc&expires=1&h=1";
    expect(isVixsrcPlaylistUrl(url)).toBe(true);
    expect(isVixsrcPlaylistUrl(url, "170060")).toBe(true);
    expect(isVixsrcPlaylistUrl(url, "999")).toBe(false);
    expect(
      isVixsrcPlaylistUrl(
        "https://vixcloud.co/playlist/170060?token=abc&expires=1&h=1",
      ),
    ).toBe(true);
  });

  it("builds API and page URLs", () => {
    expect(buildVixsrcApiUrl({ mediaType: "movie", tmdbId: 550 })).toBe(
      "https://vixsrc.to/api/movie/550",
    );
    expect(
      buildVixsrcApiUrl({
        mediaType: "tv",
        tmdbId: 1396,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toBe("https://vixsrc.to/api/tv/1396/1/1");
    expect(buildVixsrcPageUrl({ mediaType: "movie", tmdbId: 550 })).toBe(
      "https://vixsrc.to/movie/550",
    );
  });

  it("parses VixSrc API JSON including HTML wrappers", () => {
    expect(parseVixsrcApiBody('{"src":"/embed/1"}')).toEqual({
      src: "/embed/1",
    });
    expect(parseVixsrcApiBody('<pre>{"src":"/embed/movie/550"}</pre>')).toEqual(
      { src: "/embed/movie/550" },
    );
    expect(
      parseVixsrcApiBody('{"src":"https://vixcloud.co/embed/170060"}'),
    ).toEqual({ src: "https://vixcloud.co/embed/170060" });
    expect(
      parseVixsrcApiBody(
        '<pre>{"src":"/embed/170060?token=abc&amp;t=RmlnaHQ%3D&amp;expires=1"}</pre>',
      ),
    ).toEqual({
      src: "/embed/170060?token=abc&t=RmlnaHQ%3D&expires=1",
    });
  });

  it("rewrites loopback FlareSolverr proxies without a trailing slash", () => {
    expect(
      rewriteVixsrcFlareSolverrProxyUrl("http://127.0.0.1:8888/", {
        dockerHost: true,
      }),
    ).toBe("http://host.docker.internal:8888");
    expect(
      rewriteVixsrcFlareSolverrProxyUrl("http://127.0.0.1:8888/", {
        dockerHost: false,
      }),
    ).toBe("http://127.0.0.1:8888");
  });

  it("treats Cloudflare IP bans as unsolvable", () => {
    expect(
      isVixsrcCloudflareIpBan(403, "<html>Sorry, you have been blocked</html>"),
    ).toBe(true);
    expect(isVixsrcCloudflareIpBan(200, "<html>ok</html>")).toBe(false);
  });

  it("refreshes before the default playlist TTL expires", () => {
    expect(VIXSRC_REFRESH_BEFORE_MS).toBeLessThan(VIXSRC_PLAYLIST_TTL_MS);
    expect(VIXSRC_PROACTIVE_REFRESH_AFTER_MS).toBeLessThan(
      VIXSRC_REFRESH_BEFORE_MS,
    );
  });
});

describe("megaplay playback refresh", () => {
  const refresh: MegaplayPlaybackRefresh = {
    providerId: "megaplay",
    referer: "https://megaplay.buzz/",
    seedStreamUrl: "https://cdn.example/stream/abc/master.m3u8?token=old",
    megaplayId: "12345",
  };

  it("matches master URLs by origin and path", () => {
    expect(
      isMegaplayMasterPlaybackUrl(
        "https://cdn.example/stream/abc/master.m3u8?token=new",
        refresh,
      ),
    ).toBe(true);
    expect(
      isMegaplayMasterPlaybackUrl(
        "https://cdn.example/stream/abc/720p/index.m3u8",
        refresh,
      ),
    ).toBe(false);
  });
});
