import { resolveAuthSession } from "@/lib/auth/session-state";
import type { Session } from "next-auth";
import { describe, expect, test } from "vitest";

const signedIn = {
  user: { id: "user-1", email: "ada@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
} as Session;

describe("resolveAuthSession", () => {
  test("uses the fallback while the client session is still loading", () => {
    expect(resolveAuthSession(null, "loading", signedIn)).toBe(signedIn);
  });

  test("does not keep a stale server session after the client signs out", () => {
    expect(resolveAuthSession(null, "unauthenticated", signedIn)).toBeNull();
  });

  test("prefers the live client session once authenticated", () => {
    const nextSession = {
      ...signedIn,
      user: { ...signedIn.user, name: "Ada" },
    };
    expect(
      resolveAuthSession(nextSession, "authenticated", signedIn)?.user.name,
    ).toBe("Ada");
  });
});
