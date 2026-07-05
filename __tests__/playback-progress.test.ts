import { describe, expect, it } from "vitest";

import {
  clampPlaybackProgress,
  getPlaybackProgress,
  progressStorageKey,
  resolveResumeTime,
  setPlaybackProgress,
  shouldPersistPlaybackProgress,
  PLAYBACK_PROGRESS_STORAGE_KEY,
  type PlaybackProgressMap,
} from "@/lib/playback/progress-storage";

describe("progress-storage", () => {
  it("builds stable storage keys", () => {
    expect(
      progressStorageKey({
        mediaType: "movie",
        contentId: 550,
      }),
    ).toBe("movie:550::");

    expect(
      progressStorageKey({
        mediaType: "tv",
        contentId: 1399,
        seasonNumber: 1,
        episodeNumber: 3,
      }),
    ).toBe("tv:1399:1:3");
  });

  it("persists and reads playback progress", () => {
    const key = { mediaType: "movie" as const, contentId: 27205 };
    setPlaybackProgress(key, { watched: 1200, duration: 8888 });

    const saved = getPlaybackProgress(key);
    expect(saved?.watched).toBe(1200);
    expect(saved?.duration).toBe(8888);
    expect(saved?.updatedAt).toBeTypeOf("number");
  });

  it("resolves resume time from saved progress", () => {
    expect(resolveResumeTime(null)).toBe(0);
    expect(resolveResumeTime({ watched: 0, duration: 100, updatedAt: 0 })).toBe(
      0,
    );
    expect(
      resolveResumeTime({ watched: 600, duration: 7200, updatedAt: 0 }),
    ).toBe(600);
    expect(
      resolveResumeTime({ watched: 95, duration: 100, updatedAt: 0 }),
    ).toBe(0);
    expect(
      resolveResumeTime({ watched: 150, duration: 100, updatedAt: 0 }),
    ).toBe(0);
    expect(
      resolveResumeTime({ watched: 8500, duration: 8575, updatedAt: 0 }),
    ).toBe(0);
  });

  it("ignores spurious end positions when persisting", () => {
    expect(shouldPersistPlaybackProgress(0, 8575)).toBe(false);
    expect(shouldPersistPlaybackProgress(2, 8575)).toBe(false);
    expect(shouldPersistPlaybackProgress(8574, 8575)).toBe(false);
    expect(shouldPersistPlaybackProgress(120, 8575)).toBe(true);
    expect(shouldPersistPlaybackProgress(4000, 8575)).toBe(true);
  });

  it("clamps out-of-range progress before persisting", () => {
    expect(clampPlaybackProgress(1200, 6329)).toEqual({
      watched: 1200,
      duration: 6329,
    });
    expect(clampPlaybackProgress(7000, 6329)).toEqual({
      watched: 6329,
      duration: 6329,
    });
    expect(clampPlaybackProgress(-5, 100)).toEqual({
      watched: 0,
      duration: 100,
    });
  });

  it("stores entries in a shared localStorage map", () => {
    const raw = window.localStorage.getItem(PLAYBACK_PROGRESS_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as PlaybackProgressMap) : {};
    expect(map["movie:27205::"]?.watched).toBe(1200);
  });
});
