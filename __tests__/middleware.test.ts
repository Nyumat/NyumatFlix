import { DEFAULT_FLAG_VALUES } from "@/lib/flags/flag-catalog";
import {
  getCachedRawFlagsSync,
  readAdminFlagState,
} from "@/lib/flags/flipt-client";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/flags/flipt-client", () => ({
  readAdminFlagState: vi.fn(async () => ({ ...DEFAULT_FLAG_VALUES })),
  getCachedRawFlagsSync: vi.fn(() => ({ ...DEFAULT_FLAG_VALUES })),
}));

const getRedirectLocation = async (url: string) => {
  const response = await middleware(new NextRequest(url));
  return response.headers.get("location");
};

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("keeps anilist ids on TV detail urls for reverse-lookup skip", async () => {
    expect(
      await getRedirectLocation(
        "http://localhost:3000/tvshows/85937?autoplay=true&anilistId=154587",
      ),
    ).toBeNull();
  });

  test("keeps anilist ids on movie detail urls", async () => {
    expect(
      await getRedirectLocation(
        "http://localhost:3000/movies/123?anilistId=456&autoplay=true",
      ),
    ).toBeNull();
  });

  test("strips legacy tab query from detail urls", async () => {
    expect(
      await getRedirectLocation("http://localhost:3000/tvshows/85937?tab=cast"),
    ).toBe("http://localhost:3000/tvshows/85937");
  });

  test("redirects dev routes to home outside development", async () => {
    expect(
      await getRedirectLocation("http://localhost:3000/dev/og-preview"),
    ).toBe("http://localhost:3000/");
    expect(
      await getRedirectLocation(
        "http://localhost:3000/dev/og-preview/movie/550/image",
      ),
    ).toBe("http://localhost:3000/");
  });

  test("redirects live tv routes when the feature is disabled", async () => {
    expect(await getRedirectLocation("http://localhost:3000/live")).toBe(
      "http://localhost:3000/",
    );
    expect(
      await getRedirectLocation("http://localhost:3000/live?ch=espn"),
    ).toBe("http://localhost:3000/");
  });

  test("does not await Flipt on scrape routes", async () => {
    (readAdminFlagState as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => undefined),
    );
    (getCachedRawFlagsSync as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const raced = await Promise.race([
      middleware(
        new NextRequest("http://localhost:3000/api/scrape", { method: "POST" }),
      ).then((response) => ({
        kind: "done" as const,
        status: response.status,
      })),
      new Promise<{ kind: "slow" }>((resolve) => {
        setTimeout(() => resolve({ kind: "slow" }), 100);
      }),
    ]);

    expect(raced).toEqual({ kind: "done", status: 200 });
  });
});
