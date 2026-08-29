import { describe, expect, it } from "vitest";

import {
  applySubtitleCueOffset,
  clampSubtitleOffset,
  formatSubtitleOffsetLabel,
  nudgeSubtitleOffset,
} from "@/lib/playback/subtitle-offset";
import {
  getSubtitleOffset,
  setSubtitleOffset,
  subtitleOffsetScopeKey,
} from "@/lib/playback/subtitle-offset-storage";

describe("subtitle offset", () => {
  it("clamps and formats delay in tenths of a second", () => {
    expect(clampSubtitleOffset(12)).toBe(10);
    expect(clampSubtitleOffset(-12)).toBe(-10);
    expect(clampSubtitleOffset(0.16)).toBe(0.2);
    expect(formatSubtitleOffsetLabel(0)).toBe("0.0s");
    expect(formatSubtitleOffsetLabel(1.5)).toBe("+1.5s");
    expect(formatSubtitleOffsetLabel(-0.4)).toBe("-0.4s");
  });

  it("nudges with fine and coarse steps", () => {
    expect(nudgeSubtitleOffset(0, 1)).toBe(0.1);
    expect(nudgeSubtitleOffset(0, -1, true)).toBe(-1);
  });

  it("shifts cues from original times so repeat applies do not drift", () => {
    const cue = { startTime: 2.59, endTime: 4.1 };

    applySubtitleCueOffset([cue], 1);
    expect(cue.startTime).toBeCloseTo(3.59);
    expect(cue.endTime).toBeCloseTo(5.1);

    applySubtitleCueOffset([cue], 1);
    expect(cue.startTime).toBeCloseTo(3.59);
    expect(cue.endTime).toBeCloseTo(5.1);

    applySubtitleCueOffset([cue], 0);
    expect(cue.startTime).toBeCloseTo(2.59);
    expect(cue.endTime).toBeCloseTo(4.1);
  });

  it("persists delay per episode and subtitle file", () => {
    const scopeKey = subtitleOffsetScopeKey({
      mediaType: "tv",
      contentId: 62564,
      seasonNumber: 1,
      episodeNumber: 2,
    });

    expect(scopeKey).toBe("tv:62564:1:2");
    expect(setSubtitleOffset(scopeKey, "English · AniKuro", 1.2)).toBe(1.2);
    expect(getSubtitleOffset(scopeKey, "English · AniKuro")).toBe(1.2);
    expect(getSubtitleOffset(scopeKey, "en-US · AnimeOnsen")).toBe(0);
  });
});
