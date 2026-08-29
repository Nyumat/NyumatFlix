import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  auth: authMock,
}));

import { allowsCapProtectedAccess } from "@/lib/cap/access";
import { CAP_SESSION_COOKIE, createCapSessionToken } from "@/lib/cap/server";

describe("allowsCapProtectedAccess", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CAP_SESSION_SECRET = "s".repeat(64);
    authMock.mockReset();
    authMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows authenticated users without a cap session", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const request = new Request("http://localhost/api/scrape");

    await expect(allowsCapProtectedAccess(request)).resolves.toBe(true);
  });

  it("allows requests with a valid cap session cookie", async () => {
    const token = createCapSessionToken();
    const request = new Request("http://localhost/api/scrape", {
      headers: { cookie: `${CAP_SESSION_COOKIE}=${token}` },
    });

    await expect(allowsCapProtectedAccess(request)).resolves.toBe(true);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("rejects anonymous requests without a cap session", async () => {
    const request = new Request("http://localhost/api/scrape");

    await expect(allowsCapProtectedAccess(request)).resolves.toBe(false);
  });
});
