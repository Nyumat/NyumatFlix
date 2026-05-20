import {
  getMediaAboveFoldApiHref,
  getMediaAboveFoldHref,
  getMediaAboveFoldImageUrls,
  type MediaAboveFoldDetail,
} from "@/lib/media-above-fold";
import { describe, expect, test } from "vitest";

describe("media above-fold helpers", () => {
  test("builds detail and API hrefs", () => {
    expect(getMediaAboveFoldHref("movie", 550)).toBe("/movies/550");
    expect(getMediaAboveFoldHref("tv", "1399")).toBe("/tvshows/1399");
    expect(getMediaAboveFoldApiHref("movie", 550)).toBe(
      "/api/media/movie/550/above-fold",
    );
  });

  test("returns only above-fold image URLs", () => {
    const detail: MediaAboveFoldDetail = {
      id: 550,
      media_type: "movie",
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      logo: {
        aspect_ratio: 3,
        file_path: "/logo.png",
        height: 200,
        iso_639_1: "en",
        vote_average: 5,
        vote_count: 1,
        width: 600,
      },
    };

    expect(getMediaAboveFoldImageUrls(detail)).toEqual([
      "https://image.tmdb.org/t/p/w780/poster.jpg",
      "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
      "https://image.tmdb.org/t/p/w500/logo.png",
    ]);
  });
});
