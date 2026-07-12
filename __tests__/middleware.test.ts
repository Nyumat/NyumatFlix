import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";

const getRedirectLocation = (url: string) => {
  const response = middleware(new NextRequest(url));
  return response.headers.get("location");
};

describe("middleware", () => {
  test("keeps anilist ids on TV detail urls for reverse-lookup skip", () => {
    expect(
      getRedirectLocation(
        "http://localhost:3000/tvshows/85937?autoplay=true&anilistId=101922",
      ),
    ).toBeNull();
  });

  test("keeps anilist ids on movie detail urls", () => {
    expect(
      getRedirectLocation(
        "http://localhost:3000/movies/123?anilistId=456&autoplay=true",
      ),
    ).toBeNull();
  });

  test("strips legacy tab query from detail urls", () => {
    expect(
      getRedirectLocation("http://localhost:3000/tvshows/85937?tab=cast"),
    ).toBe("http://localhost:3000/tvshows/85937");
  });

  test("redirects dev routes to home outside development", () => {
    expect(getRedirectLocation("http://localhost:3000/dev/og-preview")).toBe(
      "http://localhost:3000/",
    );
    expect(
      getRedirectLocation(
        "http://localhost:3000/dev/og-preview/movie/550/image",
      ),
    ).toBe("http://localhost:3000/");
  });

  test("redirects live tv routes when the feature is disabled", () => {
    expect(getRedirectLocation("http://localhost:3000/live")).toBe(
      "http://localhost:3000/",
    );
    expect(getRedirectLocation("http://localhost:3000/live?ch=espn")).toBe(
      "http://localhost:3000/",
    );
  });
});
