import { describe, expect, it } from "vitest";

import {
  decidePlaybackAutoStart,
  hlsStartPosition,
  shouldEnforceVidstackStartAtZero,
} from "@/lib/playback/playbackStart";

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
