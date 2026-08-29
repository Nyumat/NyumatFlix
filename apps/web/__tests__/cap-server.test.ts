import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CAP_SESSION_COOKIE,
  CAP_SESSION_TTL_SECONDS,
  createCapSessionToken,
  isValidCapSessionToken,
  requestHasCapSession,
  verifyCapToken,
} from "@/lib/cap/server";

describe("Cap server verification", () => {
  beforeEach(() => {
    process.env.CAP_API_ENDPOINT = "http://localhost:3030/abc123/";
    process.env.CAP_SECRET_KEY = "sk-test";
    process.env.CAP_SESSION_SECRET = "s".repeat(64);
    vi.restoreAllMocks();
  });

  it("accepts a fresh signed session and rejects expiry or tampering", () => {
    const now = Date.now();
    const token = createCapSessionToken(now);
    expect(isValidCapSessionToken(token, now)).toBe(true);
    expect(
      isValidCapSessionToken(
        token,
        now + (CAP_SESSION_TTL_SECONDS + 60) * 1000,
      ),
    ).toBe(false);
    expect(isValidCapSessionToken(`${token}x`, now)).toBe(false);

    const request = new Request("http://localhost/api/scrape", {
      headers: { cookie: `${CAP_SESSION_COOKIE}=${token}` },
    });
    expect(requestHasCapSession(request)).toBe(true);
  });

  it("verifies a Cap token through siteverify", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

    await expect(verifyCapToken("valid-token")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://localhost:3030/abc123/siteverify"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          secret: "sk-test",
          response: "valid-token",
        }),
      }),
    );
  });

  it("fails closed for missing tokens and upstream errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));

    await expect(verifyCapToken(undefined)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(verifyCapToken("token")).resolves.toBe(false);
  });
});
