import { describe, expect, it } from "vitest";

import {
  scorePayloadWithStartupProbe,
  scorePlaybackStartupMs,
  pickBestCachedFallback,
} from "@/lib/scrape/playback-startup-score";

describe("playback startup score", () => {
  it("rewards lower startup latency", () => {
    expect(scorePlaybackStartupMs(300)).toBeGreaterThan(
      scorePlaybackStartupMs(3_000),
    );
  });

  it("prefers a fast startup over a slow one when metadata scores tie", () => {
    const base = 1_500;
    const fast = scorePayloadWithStartupProbe(base, {
      startupProbeOk: true,
      startupProbeMs: 400,
    });
    const slow = scorePayloadWithStartupProbe(base, {
      startupProbeOk: true,
      startupProbeMs: 4_000,
    });

    expect(fast).toBeGreaterThan(slow);
  });

  it("penalizes failed and pending startup probes", () => {
    const base = 2_000;
    const ok = scorePayloadWithStartupProbe(base, {
      startupProbeOk: true,
      startupProbeMs: 500,
    });
    const failed = scorePayloadWithStartupProbe(base, {
      startupProbeOk: false,
      startupProbeMs: 500,
    });
    const pending = scorePayloadWithStartupProbe(base, {});

    expect(ok).toBeGreaterThan(failed);
    expect(failed).toBeGreaterThan(pending);
  });

  it("picks the highest-scored warmed fallback", () => {
    const cache = new Map([
      ["justanime", { startupProbeOk: true, startupProbeMs: 4_000 }],
      ["kickassanime", { startupProbeOk: true, startupProbeMs: 900 }],
    ] as const);

    const picked = pickBestCachedFallback({
      order: ["justanime", "kickassanime"],
      cache,
      failed: new Set<string>(),
      scorePayload: (payload) => scorePayloadWithStartupProbe(1_000, payload),
      requireStartupProbePass: true,
    });

    expect(picked?.providerId).toBe("kickassanime");
  });

  it("skips failed startup probes when a passing sibling exists", () => {
    const cache = new Map([
      ["justanime", { startupProbeOk: false, startupProbeMs: 500 }],
      ["anizone", { startupProbeOk: true, startupProbeMs: 1_200 }],
    ] as const);

    const picked = pickBestCachedFallback({
      order: ["justanime", "anizone"],
      cache,
      failed: new Set<string>(),
      scorePayload: (payload) => scorePayloadWithStartupProbe(1_000, payload),
      requireStartupProbePass: true,
    });

    expect(picked?.providerId).toBe("anizone");
  });
});
