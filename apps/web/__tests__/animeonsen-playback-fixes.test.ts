import { describe, expect, it } from "vitest";

import { ANIME_COORDS_PENDING_TIMEOUT_MS } from "@/lib/anime/anime-playback-policy";
import { shouldReScrapeSameProviderOnPlaybackError } from "@/lib/playback/playbackStart";
import { trimDashStartupSubtitles } from "@/lib/playback/dash-startup-subtitles";

describe("shouldReScrapeSameProviderOnPlaybackError", () => {
  it("returns true when the play url embeds a refresh token", () => {
    expect(
      shouldReScrapeSameProviderOnPlaybackError(
        "/api/scrape/play/eyJ1cmwiOiJodHRwczovL2V4YW1wbGUuY29tL21hc3Rlci5tM3U4IiwicmVmcmVzaCI6eyJwcm92aWRlciI6InZpZGtpbmciLCJ0b2tlbiI6ImFiYyJ9fQ/asset.m3u8",
      ),
    ).toBe(true);
  });

  it("returns false when the play url has no refresh token", () => {
    expect(
      shouldReScrapeSameProviderOnPlaybackError(
        "/api/scrape/play/eyJ1cmwiOiJodHRwczovL2Nkbi5hbmltZW9uc2VuLnh5ei92aWRlby9tcDQtZGFzaC9MdjR0aVVlU1lCTm4yQ0ozLzEvbWFuaWZlc3QubXBkIiwicmVmZXJlciI6Imh0dHBzOi8vd3d3LmFuaW1lb25zZW4ueHl6LyJ9/asset.mpd",
      ),
    ).toBe(false);
    expect(
      shouldReScrapeSameProviderOnPlaybackError(
        "https://example.com/stream.m3u8",
      ),
    ).toBe(false);
  });
});

describe("trimDashStartupSubtitles", () => {
  it("keeps preferred and english tracks first", () => {
    const trimmed = trimDashStartupSubtitles(
      [
        { lang: "de-DE", url: "https://example.com/de.vtt" },
        { lang: "en-US", url: "https://example.com/en.vtt" },
        { lang: "es-ES", url: "https://example.com/es.vtt" },
        { lang: "fr-FR", url: "https://example.com/fr.vtt" },
      ],
      "en-US",
    );

    expect(trimmed?.map((track) => track.lang)).toEqual([
      "en-US",
      "de-DE",
      "es-ES",
    ]);
  });
});

describe("ANIME_COORDS_PENDING_TIMEOUT_MS", () => {
  it("uses a bounded wait before falling back", () => {
    expect(ANIME_COORDS_PENDING_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(ANIME_COORDS_PENDING_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });
});
