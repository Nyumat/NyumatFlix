import { describe, expect, it } from "vitest";

import {
  ANIPM_CANDIDATE_TIMEOUT_MS,
  ANIPM_SERVER_TIMEOUT_MS,
  PLAYABLE_CANDIDATE_BATCH,
  PLAYABLE_CANDIDATE_LIMIT,
  toAnipmEpisodeSlug,
} from "@/lib/scrape/anime/providers/anipm";
import {
  parseDashDurationSeconds,
  parseIso8601DurationSeconds,
  streamDurationMatchesExpected,
} from "@/lib/scrape/stream-duration";

describe("ani.pm provider helpers", () => {
  it("rewrites catalog slugs for later episodes", () => {
    expect(toAnipmEpisodeSlug("modaete-yo-adam-kun-1", 2)).toBe(
      "modaete-yo-adam-kun-2",
    );
    expect(toAnipmEpisodeSlug("some-show", 3)).toBe("some-show-3");
  });

  it("caps server and candidate probes at 8s and races two at a time", () => {
    expect(ANIPM_SERVER_TIMEOUT_MS).toBe(8_000);
    expect(ANIPM_CANDIDATE_TIMEOUT_MS).toBe(8_000);
    expect(PLAYABLE_CANDIDATE_BATCH).toBe(2);
    expect(PLAYABLE_CANDIDATE_LIMIT).toBe(4);
  });

  it("parses dash runtimes from manifests", () => {
    expect(
      parseDashDurationSeconds(
        '<MPD mediaPresentationDuration="PT6M32.3S"></MPD>',
      ),
    ).toBeCloseTo(392.3, 1);
    expect(parseIso8601DurationSeconds("PT23M50S")).toBe(1430);
  });

  it("rejects obvious false positives from short-episode shows", () => {
    expect(streamDurationMatchesExpected(392, 7)).toBe(true);
    expect(streamDurationMatchesExpected(1430, 4)).toBe(false);
    expect(streamDurationMatchesExpected(1430, 7)).toBe(false);
  });
});
