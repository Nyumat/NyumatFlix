import { describe, expect, it } from "vitest";
import {
  credentialIdToBase64Url,
  fromBase64Url,
  toBase64Url,
} from "@/lib/passkeys/encoding";

describe("passkey encoding", () => {
  it("round-trips base64url user handles", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const encoded = toBase64Url(bytes);
    expect(fromBase64Url(encoded)).toEqual(bytes);
  });

  it("converts stored base64 credential ids to base64url", () => {
    const base64 = Buffer.from("hello-passkey").toString("base64");
    expect(credentialIdToBase64Url(base64)).toBe(
      Buffer.from("hello-passkey").toString("base64url"),
    );
  });
});
