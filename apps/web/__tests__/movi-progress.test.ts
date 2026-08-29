import { describe, expect, it } from "vitest";

import {
  clampPlaybackProgress,
  resolveResumeTime,
  shouldPersistPlaybackProgress,
} from "@/lib/playback/progress-storage";

describe("movi progress integration expectations", () => {
  it("persists mid-playback positions for movies", () => {
    expect(shouldPersistPlaybackProgress(120, 3600)).toBe(true);
    expect(clampPlaybackProgress(120, 3600)).toEqual({
      watched: 120,
      duration: 3600,
    });
  });

  it("resolves resume time from saved progress", () => {
    const resume = resolveResumeTime({
      watched: 900,
      duration: 7200,
      updatedAt: Date.now(),
    });
    expect(resume).toBe(900);
  });
});
