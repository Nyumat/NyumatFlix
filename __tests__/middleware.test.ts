import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";

const getRedirectLocation = (url: string) => {
  const response = middleware(new NextRequest(url));
  return response.headers.get("location");
};

describe("middleware", () => {
  test("strips legacy anilist ids from TV detail urls", () => {
    expect(
      getRedirectLocation(
        "http://localhost:3000/tvshows/85937?autoplay=true&anilistId=101922",
      ),
    ).toBe("http://localhost:3000/tvshows/85937?autoplay=true");
  });

  test("strips legacy anilist ids from movie detail urls", () => {
    expect(
      getRedirectLocation(
        "http://localhost:3000/movies/123?anilistId=456&autoplay=true",
      ),
    ).toBe("http://localhost:3000/movies/123?autoplay=true");
  });
});
