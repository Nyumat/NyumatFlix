import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bytesToBase64Url, hmacSha256 } from "@/lib/scrape/playback-mac";
import {
  buildScrapePlayUrl,
  decodeScrapePlaybackToken,
  encodeScrapePlaybackToken,
  extractScrapePlaybackRefreshFromPlayUrl,
  isBlockedPlaybackTarget,
} from "@/lib/scrape/playback";

describe("playback token mac", () => {
  it("matches node hmac-sha256", () => {
    const message = "playback-body";
    const secret = "vitest-auth-secret";
    const ours = Buffer.from(
      bytesToBase64Url(hmacSha256(secret, message)),
      "base64url",
    );
    const node = createHmac("sha256", secret).update(message).digest();
    expect(Buffer.compare(ours, node)).toBe(0);
  });
});

describe("scrape playback tokens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a signed token and rejects an unsigned one", () => {
    const token = encodeScrapePlaybackToken({
      url: "https://cdn.example.com/master.m3u8",
      referer: "https://example.com",
    });
    expect(decodeScrapePlaybackToken(token)).toMatchObject({
      url: "https://cdn.example.com/master.m3u8",
      referer: "https://example.com",
    });

    const unsigned = token.slice(0, token.lastIndexOf("~"));
    expect(decodeScrapePlaybackToken(unsigned)).toBeNull();
  });

  it("expires after six hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = encodeScrapePlaybackToken({
      url: "https://cdn.example.com/master.m3u8",
    });
    vi.setSystemTime(new Date("2026-01-01T05:59:00Z"));
    expect(decodeScrapePlaybackToken(token)?.url).toBe(
      "https://cdn.example.com/master.m3u8",
    );
    vi.setSystemTime(new Date("2026-01-01T06:00:01Z"));
    expect(decodeScrapePlaybackToken(token)).toBeNull();
  });

  it("rejects private and metadata targets", () => {
    expect(isBlockedPlaybackTarget("http://127.0.0.1/latest")).toBe(true);
    expect(
      isBlockedPlaybackTarget("http://169.254.169.254/latest/meta-data/"),
    ).toBe(true);
    expect(isBlockedPlaybackTarget("http://10.0.0.5/stream.m3u8")).toBe(true);
    expect(isBlockedPlaybackTarget("http://[::1]/stream.m3u8")).toBe(true);
    expect(isBlockedPlaybackTarget("https://cdn.example.com/master.m3u8")).toBe(
      false,
    );

    const token = encodeScrapePlaybackToken({
      url: "http://169.254.169.254/latest/meta-data/",
    });
    expect(decodeScrapePlaybackToken(token)).toBeNull();
  });

  it("still reads refresh metadata from an unsigned legacy token", () => {
    const refresh = {
      providerId: "vidking" as const,
      mediaType: "movie" as const,
      tmdbId: 395992,
      seedFetchedAt: 1,
    };
    const playUrl = buildScrapePlayUrl({
      url: "https://cdn.example.com/master.m3u8",
      refresh,
    });
    expect(extractScrapePlaybackRefreshFromPlayUrl(playUrl)).toEqual(refresh);

    expect(
      extractScrapePlaybackRefreshFromPlayUrl(
        "/api/scrape/play/eyJ1cmwiOiJodHRwczovL2V4YW1wbGUuY29tL21hc3Rlci5tM3U4IiwicmVmcmVzaCI6eyJwcm92aWRlciI6InZpZGtpbmciLCJ0b2tlbiI6ImFiYyJ9fQ/asset.m3u8",
      ),
    ).toEqual({ provider: "vidking", token: "abc" });
  });
});
