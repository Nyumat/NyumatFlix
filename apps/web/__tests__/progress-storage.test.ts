import { describe, expect, it } from "vitest";

import {
  mergePlaybackProgressEntry,
  PLAYBACK_PROGRESS_STORAGE_KEY,
  setPlaybackProgress,
  getPlaybackProgress,
} from "@/lib/playback/progress-storage";

describe("mergePlaybackProgressEntry", () => {
  it("accepts a newer write outright", () => {
    const merged = mergePlaybackProgressEntry(
      { watched: 100, duration: 1000, updatedAt: 100 },
      { watched: 250, duration: 1000 },
      200,
    );

    expect(merged).toEqual({
      watched: 250,
      duration: 1000,
      updatedAt: 200,
    });
  });

  it("keeps the newer timestamp when an older write arrives late", () => {
    const merged = mergePlaybackProgressEntry(
      { watched: 500, duration: 1000, updatedAt: 500 },
      { watched: 100, duration: 1000 },
      100,
    );

    expect(merged).toEqual({
      watched: 500,
      duration: 1000,
      updatedAt: 500,
    });
  });

  it("still accepts higher watched from a slower tab when timestamps are stale", () => {
    const merged = mergePlaybackProgressEntry(
      { watched: 100, duration: 1000, updatedAt: 500 },
      { watched: 450, duration: 1000 },
      100,
    );

    expect(merged).toEqual({
      watched: 450,
      duration: 1000,
      updatedAt: 500,
    });
  });
});

describe("setPlaybackProgress", () => {
  it("merges per-key without dropping unrelated titles", () => {
    window.localStorage.removeItem(PLAYBACK_PROGRESS_STORAGE_KEY);

    setPlaybackProgress(
      { mediaType: "movie", contentId: 550 },
      { watched: 100, duration: 1000 },
    );
    setPlaybackProgress(
      { mediaType: "tv", contentId: 1399, seasonNumber: 1, episodeNumber: 1 },
      { watched: 200, duration: 2000 },
    );

    expect(getPlaybackProgress({ mediaType: "movie", contentId: 550 })).toEqual(
      expect.objectContaining({ watched: 100 }),
    );
    expect(
      getPlaybackProgress({
        mediaType: "tv",
        contentId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toEqual(expect.objectContaining({ watched: 200 }));
  });
});
