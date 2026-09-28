import { afterEach, describe, expect, it } from "vitest";
import {
  resolvePasskeyEndpointUrls,
  resolveWebAuthnRelatedOrigins,
  resolveWebAuthnRpId,
} from "@/lib/passkeys/rp-config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("passkey rp config", () => {
  it("uses configured rp id when provided", () => {
    process.env.WEBAUTHN_RP_ID = "nyumatflix.com";
    process.env.AUTH_URL = "https://nyumatflix.com";
    expect(resolveWebAuthnRpId()).toBe("nyumatflix.com");
  });

  it("includes related origins from env", () => {
    process.env.AUTH_URL = "https://nyumatflix.com";
    process.env.WEBAUTHN_RELATED_ORIGINS =
      "https://preview.nyumatflix.com,https://staging.nyumatflix.com";
    const origins = resolveWebAuthnRelatedOrigins();
    expect(origins).toContain("https://nyumatflix.com");
    expect(origins).toContain("https://preview.nyumatflix.com");
  });

  it("advertises settings endpoints for passkey management", () => {
    process.env.AUTH_URL = "https://nyumatflix.com";
    expect(resolvePasskeyEndpointUrls()).toEqual({
      enroll: "https://nyumatflix.com/settings",
      manage: "https://nyumatflix.com/settings",
    });
  });
});
