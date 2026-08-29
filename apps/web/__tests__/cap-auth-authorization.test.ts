import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isCapVerifiedSignIn,
  withCapVerifiedSignIn,
} from "@/lib/cap/auth-authorization";

describe("Cap auth authorization", () => {
  it("only marks work inside the verified sign-in context", async () => {
    expect(isCapVerifiedSignIn()).toBe(false);
    await withCapVerifiedSignIn(async () => {
      expect(isCapVerifiedSignIn()).toBe(true);
      await Promise.resolve();
      expect(isCapVerifiedSignIn()).toBe(true);
    });
    expect(isCapVerifiedSignIn()).toBe(false);
  });
});
