import { describe, expect, it } from "vitest";
import {
  lookupAaguidName,
  normalizeAaguid,
} from "@/lib/passkeys/aaguid-inventory";
import { resolvePasskeyPresentation } from "@/lib/passkeys/passkey-presentation";

describe("passkey presentation", () => {
  it("resolves known aaguids from the inventory", () => {
    expect(lookupAaguidName("ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4")).toBe(
      "Google Password Manager",
    );
  });

  it("normalizes compact aaguid strings", () => {
    expect(normalizeAaguid("ea9b8d664d011d213ce4b6b48cb575d4")).toBe(
      "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
    );
  });

  it("prefers nickname over authenticator name", () => {
    const presentation = resolvePasskeyPresentation({
      nickname: "Work laptop",
      aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
      credentialBackedUp: true,
      fallbackIndex: 0,
    });

    expect(presentation.title).toBe("Work laptop");
    expect(presentation.subtitle).toContain("Google Password Manager");
  });

  it("falls back to authenticator name when nickname is missing", () => {
    const presentation = resolvePasskeyPresentation({
      nickname: null,
      aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
      credentialBackedUp: false,
      fallbackIndex: 2,
    });

    expect(presentation.title).toBe("Google Password Manager");
    expect(presentation.subtitle).toBe("Device passkey");
  });
});
