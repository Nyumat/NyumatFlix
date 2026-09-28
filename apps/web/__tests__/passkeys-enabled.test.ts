import { describe, expect, it } from "vitest";
import {
  arePasskeysEnabledFromRaw,
  isPasskeyAuthPath,
} from "@/lib/passkeys/passkeys-enabled";
import { resolveSiteFlags } from "@/lib/flags/site-flags";

describe("passkeys feature flag", () => {
  it("is disabled by default", () => {
    expect(arePasskeysEnabledFromRaw({})).toBe(false);
    expect(resolveSiteFlags({}).passkeysEnabled).toBe(false);
  });

  it("enables only when global.passkeys_enabled is true", () => {
    expect(arePasskeysEnabledFromRaw({ "global.passkeys_enabled": true })).toBe(
      true,
    );
  });

  it("matches passkey auth paths for middleware blocking", () => {
    expect(isPasskeyAuthPath("/api/account/passkeys")).toBe(true);
    expect(isPasskeyAuthPath("/api/auth/callback/passkey")).toBe(true);
    expect(isPasskeyAuthPath("/.well-known/passkey-endpoints")).toBe(true);
    expect(isPasskeyAuthPath("/login")).toBe(false);
  });
});
