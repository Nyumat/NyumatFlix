import { describe, expect, it } from "vitest";

import {
  clearLivePlayhead,
  readLivePlayhead,
  rememberLivePlayhead,
  sourceSwitchStartPosition,
} from "@/lib/playback/source-switch-resume";

describe("sourceSwitchStartPosition", () => {
  it("continues from the live playhead when a source is swapped mid-stream", () => {
    expect(sourceSwitchStartPosition(0, 600)).toBe(600);
    expect(sourceSwitchStartPosition(90, 600)).toBe(600);
  });

  it("falls back to the stored bookmark when playback has not moved", () => {
    expect(sourceSwitchStartPosition(90, 0)).toBe(90);
    expect(sourceSwitchStartPosition(0, 0)).toBe(0);
  });
});

describe("live playhead", () => {
  it("keeps the mid-stream position when the next source restarts near zero", () => {
    const key = "movie:1::";
    clearLivePlayhead(key);
    rememberLivePlayhead(key, 600);
    rememberLivePlayhead(key, 2);
    expect(readLivePlayhead(key)).toBe(600);
    clearLivePlayhead(key);
  });

  it("follows a real rewind", () => {
    const key = "movie:2::";
    clearLivePlayhead(key);
    rememberLivePlayhead(key, 600);
    rememberLivePlayhead(key, 120);
    expect(readLivePlayhead(key)).toBe(120);
    clearLivePlayhead(key);
  });
});
