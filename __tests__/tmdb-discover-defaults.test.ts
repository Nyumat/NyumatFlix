import { describe, expect, test } from "vitest";
import {
  defaultMovieDiscoverIncludeVideo,
  isMovieDiscoverEndpoint,
  withMovieDiscoverIncludeVideo,
} from "@/lib/tmdb-discover-defaults";

describe("tmdb movie discover video default", () => {
  test("recognizes movie discover endpoints", () => {
    expect(isMovieDiscoverEndpoint("/discover/movie")).toBe(true);
    expect(isMovieDiscoverEndpoint("discover/movie")).toBe(true);
    expect(isMovieDiscoverEndpoint("/discover/tv")).toBe(false);
    expect(isMovieDiscoverEndpoint("/movie/popular")).toBe(false);
  });

  test("defaults include_video to true unless the caller sets it", () => {
    expect(defaultMovieDiscoverIncludeVideo(undefined)).toBe("true");
    expect(defaultMovieDiscoverIncludeVideo(true)).toBe("true");
    expect(defaultMovieDiscoverIncludeVideo(false)).toBe("false");
    expect(defaultMovieDiscoverIncludeVideo("false")).toBe("false");
  });

  test("fills include_video on movie discover params without overwriting an explicit value", () => {
    expect(
      withMovieDiscoverIncludeVideo({ sort_by: "popularity.desc" }),
    ).toEqual({
      include_video: "true",
      sort_by: "popularity.desc",
    });
    expect(
      withMovieDiscoverIncludeVideo({
        include_video: "false",
        sort_by: "popularity.desc",
      }),
    ).toEqual({
      include_video: "false",
      sort_by: "popularity.desc",
    });
  });
});
