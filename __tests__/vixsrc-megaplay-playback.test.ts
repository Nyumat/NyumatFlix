import { describe, expect, it } from "vitest";

import {
  buildVixsrcPlaylistUrl,
  extractVixsrcPlaylistParams,
  isVixsrcPlaylistUrl,
} from "@/lib/scrape/vixsrc-shared";
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
  });

  it("detects VixSrc playlist URLs", () => {
    const url = "https://vixsrc.to/playlist/170060?token=abc&expires=1&h=1";
    expect(isVixsrcPlaylistUrl(url)).toBe(true);
    expect(isVixsrcPlaylistUrl(url, "170060")).toBe(true);
    expect(isVixsrcPlaylistUrl(url, "999")).toBe(false);
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
