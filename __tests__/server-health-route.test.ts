import { beforeEach, describe, expect, it, vi } from "vitest";

const healthMocks = vi.hoisted(() => ({
  check: vi.fn(),
}));

vi.mock("@/lib/server/video-server-health", () => ({
  checkVideoServerUrl: healthMocks.check,
  isAllowedVideoServerUrl: (value: string) => value.startsWith("https://"),
}));

import { POST } from "@/app/api/servers/health/route";

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/servers/health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("server health route", () => {
  beforeEach(() => {
    healthMocks.check.mockReset();
    healthMocks.check.mockImplementation(async (url: string) => ({
      available: true,
      state: "available",
      status: 200,
      method: "GET",
      evidence: "http-status",
      url,
    }));
  });

  it("checks a bounded batch in one request", async () => {
    const urls = [
      "https://vidfast.pro/movie/550",
      "https://vsembed.ru/embed/movie?tmdb=550",
    ];
    const response = await POST(makeRequest({ urls }));
    const payload = (await response.json()) as { results: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.results).toHaveLength(2);
    expect(healthMocks.check).toHaveBeenCalledTimes(2);
  });

  it("rejects oversized batches", async () => {
    const urls = Array.from(
      { length: 13 },
      (_, index) => `https://vidfast.pro/movie/${index + 1}`,
    );
    const response = await POST(makeRequest({ urls }));

    expect(response.status).toBe(400);
    expect(healthMocks.check).not.toHaveBeenCalled();
  });
});
