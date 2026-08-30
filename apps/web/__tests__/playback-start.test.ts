import { describe, expect, it } from "vitest";

import {
  decidePlaybackAutoStart,
  hlsStartPosition,
  PLAYBACK_START_TIMEOUT_MS,
  VIDSTACK_START_TIMEOUT_MS,
  shouldEnforceVidstackStartAtZero,
  vidstackScrapeStartTimeoutMs,
} from "@/lib/playback/playbackStart";

describe("PLAYBACK_START_TIMEOUT_MS", () => {
  it("is a positive fallback window for stalled players", () => {
    expect(PLAYBACK_START_TIMEOUT_MS).toBeGreaterThan(10_000);
  });
});

describe("vidstackScrapeStartTimeoutMs", () => {
  it("fails scrape HLS after 30s if metadata never arrives", () => {
    expect(VIDSTACK_START_TIMEOUT_MS).toBe(30_000);
    expect(
      vidstackScrapeStartTimeoutMs("https://cdn.example/master.m3u8"),
    ).toBe(30_000);
  });

  it("keeps a longer window for transcode playlists", () => {
    expect(
      vidstackScrapeStartTimeoutMs("/api/direct/transcode/playlist?u=x"),
    ).toBe(PLAYBACK_START_TIMEOUT_MS);
  });
});

describe("shouldEnforceVidstackStartAtZero", () => {
  it("enforces start-at-zero for HLS when there is no resume time", () => {
    expect(
      shouldEnforceVidstackStartAtZero(
        "vidstack-hls",
        "/api/direct/transcode/playlist?u=x",
      ),
    ).toBe(true);
  });

  it("skips start-at-zero when a resume position exists", () => {
    expect(
      shouldEnforceVidstackStartAtZero(
        "vidstack-hls",
        "/api/direct/transcode/playlist?u=x",
        900,
      ),
    ).toBe(false);
    expect(
      shouldEnforceVidstackStartAtZero(
        "vidstack-direct",
        "/api/direct/transcode/file?u=x",
        120,
      ),
    ).toBe(false);
  });
});

describe("hlsStartPosition", () => {
  it("returns zero without saved progress and the resume time otherwise", () => {
    expect(hlsStartPosition(0)).toBe(0);
    expect(hlsStartPosition(-1)).toBe(0);
    expect(hlsStartPosition(900)).toBe(900);
  });
});

describe("decidePlaybackAutoStart", () => {
  it("starts only before the first successful play", () => {
    expect(
      decidePlaybackAutoStart({
        autoPlay: true,
        hasStarted: false,
        isCurrentlyPlaying: false,
      }),
    ).toBe("start");
  });

  it("does not restart after the user pauses", () => {
    expect(
      decidePlaybackAutoStart({
        autoPlay: true,
        hasStarted: true,
        isCurrentlyPlaying: false,
      }),
    ).toBe("skip");
  });

  it("marks an already-playing video instead of calling play again", () => {
    expect(
      decidePlaybackAutoStart({
        autoPlay: true,
        hasStarted: false,
        isCurrentlyPlaying: true,
      }),
    ).toBe("already-playing");
  });
});
