import { DEFAULT_FLAG_VALUES } from "@/lib/flags/flag-catalog";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/flags/flipt-client", () => ({
  readAdminFlagState: vi.fn(async () => ({ ...DEFAULT_FLAG_VALUES })),
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
        "http://localhost:3000/tvshows/85937?autoplay=true&anilistId=101922",
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
});
