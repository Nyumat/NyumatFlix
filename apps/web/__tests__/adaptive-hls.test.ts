import { describe, expect, it } from "vitest";

import {
  buildLiveHlsConfig,
  isDegradingHlsError,
  shouldDisableLowLatency,
} from "@/lib/live/adaptive-hls";

describe("adaptive hls", () => {
  it("builds config with low latency toggle", () => {
    expect(buildLiveHlsConfig(true).lowLatencyMode).toBe(true);
    expect(buildLiveHlsConfig(false).lowLatencyMode).toBe(false);
  });

  it("detects degrading hls errors", () => {
    expect(
      isDegradingHlsError({
        fatal: false,
        details: "bufferSeekOverHole",
      } as never),
    ).toBe(true);
    expect(
      isDegradingHlsError({
        fatal: true,
        details: "unknown",
      } as never),
    ).toBe(true);
    expect(
      isDegradingHlsError({
        fatal: false,
        details: "unknown",
      } as never),
    ).toBe(false);
  });

  it("disables low latency after repeated degrading errors", () => {
    const detail = {
      fatal: false,
      details: "bufferSeekOverHole",
    } as never;

    expect(shouldDisableLowLatency(detail, 1)).toBe(false);
    expect(shouldDisableLowLatency(detail, 2)).toBe(true);
  });

  it("disables low latency immediately on fatal errors", () => {
    expect(
      shouldDisableLowLatency(
        {
          fatal: true,
          details: "fragLoadError",
        } as never,
        1,
      ),
    ).toBe(true);
  });
});
