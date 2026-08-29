import {
  loginErrorHref,
  loginHref,
  loginVerifyHref,
  safeAuthCallbackPath,
} from "@/lib/auth/callback-url";
import { describe, expect, test } from "vitest";

describe("safeAuthCallbackPath", () => {
  test("keeps same-origin relative paths", () => {
    expect(safeAuthCallbackPath("/watchlist")).toBe("/watchlist");
    expect(safeAuthCallbackPath("/movies/123?tab=overview")).toBe(
      "/movies/123?tab=overview",
    );
  });

  test("rejects open redirects", () => {
    expect(safeAuthCallbackPath("https://evil.example")).toBe("/");
    expect(safeAuthCallbackPath("//evil.example")).toBe("/");
    expect(safeAuthCallbackPath("/\\evil.example")).toBe("/");
    expect(safeAuthCallbackPath("login")).toBe("/");
  });

  test("rejects auth routes so signed-in users cannot loop on /login", () => {
    expect(safeAuthCallbackPath("/login")).toBe("/");
    expect(safeAuthCallbackPath("/login/verify")).toBe("/");
    expect(safeAuthCallbackPath("/login?callbackUrl=/watchlist")).toBe("/");
  });

  test("falls back for missing values", () => {
    expect(safeAuthCallbackPath(undefined)).toBe("/");
    expect(safeAuthCallbackPath(null)).toBe("/");
    expect(safeAuthCallbackPath("   ")).toBe("/");
  });
});

describe("loginHref", () => {
  test("omits the query when the callback is home", () => {
    expect(loginHref("/")).toBe("/login");
    expect(loginHref(undefined)).toBe("/login");
  });

  test("encodes a safe return path", () => {
    expect(loginHref("/watchlist")).toBe("/login?callbackUrl=%2Fwatchlist");
    expect(loginHref("/tvshows/1?season=2")).toBe(
      "/login?callbackUrl=%2Ftvshows%2F1%3Fseason%3D2",
    );
  });
});

describe("loginErrorHref", () => {
  test("keeps the callback on captcha and provider errors", () => {
    expect(loginErrorHref("Captcha")).toBe("/login/error?error=Captcha");
    expect(loginErrorHref("Captcha", "/watchlist")).toBe(
      "/login/error?error=Captcha&callbackUrl=%2Fwatchlist",
    );
  });
});

describe("loginVerifyHref", () => {
  test("carries the return path and optional dev magic link", () => {
    expect(loginVerifyHref()).toBe("/login/verify");
    expect(loginVerifyHref({ callbackUrl: "/settings" })).toBe(
      "/login/verify?callbackUrl=%2Fsettings",
    );
    expect(
      loginVerifyHref({
        callbackUrl: "/watchlist",
        devLink: "https://example.com/magic",
      }),
    ).toBe(
      "/login/verify?devLink=https%3A%2F%2Fexample.com%2Fmagic&callbackUrl=%2Fwatchlist",
    );
  });
});
