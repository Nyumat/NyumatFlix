import { describe, expect, it } from "vitest";
import { isAmbientGlowEnabledFromRaw } from "@/lib/flags/ambient-glow-enabled";
import { resolveSiteFlags } from "@/lib/flags/site-flags";

describe("ambient glow feature flag", () => {
  it("is disabled by default", () => {
    expect(isAmbientGlowEnabledFromRaw({})).toBe(false);
    expect(resolveSiteFlags({}).ambientGlowEnabled).toBe(false);
  });

  it("enables only when global.ambient_glow_enabled is true", () => {
    expect(
      isAmbientGlowEnabledFromRaw({ "global.ambient_glow_enabled": true }),
    ).toBe(true);
    expect(
      resolveSiteFlags({ "global.ambient_glow_enabled": true })
        .ambientGlowEnabled,
    ).toBe(true);
  });
});
