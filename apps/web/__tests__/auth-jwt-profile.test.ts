import {
  applyAuthDbProfileToJwt,
  applyAuthSessionUpdateToJwt,
  applyAuthUserToJwt,
  shouldRefreshAuthJwtFromDatabase,
} from "@/lib/auth/jwt-profile";
import type { JWT } from "next-auth/jwt";
import { describe, expect, test } from "vitest";

const baseToken = (): JWT => ({
  uid: "user-1",
});

describe("shouldRefreshAuthJwtFromDatabase", () => {
  test("does not hit the database for nameless magic-link users after hydration", () => {
    expect(
      shouldRefreshAuthJwtFromDatabase(
        { uid: "user-1", profileHydrated: true },
        "signIn",
      ),
    ).toBe(false);
  });

  test("refreshes once for legacy cookies that never set profileHydrated", () => {
    expect(shouldRefreshAuthJwtFromDatabase({ uid: "user-1" }, undefined)).toBe(
      true,
    );
  });

  test("always refreshes on session update", () => {
    expect(
      shouldRefreshAuthJwtFromDatabase(
        { uid: "user-1", profileHydrated: true },
        "update",
      ),
    ).toBe(true);
  });

  test("skips tokens without a user id", () => {
    expect(shouldRefreshAuthJwtFromDatabase({}, "update")).toBe(false);
  });
});

describe("applyAuthUserToJwt", () => {
  test("marks the token hydrated even when the user has no display name", () => {
    const token = applyAuthUserToJwt(baseToken(), {
      id: "user-1",
      email: "ada@example.com",
    });

    expect(token.profileHydrated).toBe(true);
    expect(token.email).toBe("ada@example.com");
    expect(token.name).toBeUndefined();
  });
});

describe("applyAuthSessionUpdateToJwt", () => {
  test("copies name and image onto the token", () => {
    const token = applyAuthSessionUpdateToJwt(baseToken(), {
      name: "Ada",
      image: "avatar://blue",
    });

    expect(token.name).toBe("Ada");
    expect(token.picture).toBe("avatar://blue");
  });
});

describe("applyAuthDbProfileToJwt", () => {
  test("hydrates the token from the database profile", () => {
    const token = applyAuthDbProfileToJwt(baseToken(), {
      name: "Ada",
      email: "ada@example.com",
      image: null,
    });

    expect(token.name).toBe("Ada");
    expect(token.email).toBe("ada@example.com");
    expect(token.profileHydrated).toBe(true);
  });
});
