import { pickHeroBackdropPath } from "@/lib/catalog-hub-backdrop";

describe("pickHeroBackdropPath", () => {
  it("prefers TMDB primary backdrop when it is wide enough", () => {
    const path = pickHeroBackdropPath({
      backdrop_path: "/primary.jpg",
      images: {
        backdrops: [
          {
            file_path: "/primary.jpg",
            width: 1920,
            height: 1080,
            aspect_ratio: 16 / 9,
            iso_639_1: "en",
            vote_average: 5,
            vote_count: 1,
          },
          {
            file_path: "/huge.jpg",
            width: 3840,
            height: 2160,
            aspect_ratio: 16 / 9,
            iso_639_1: "en",
            vote_average: 5,
            vote_count: 1,
          },
        ],
      },
    });
    expect(path).toBe("/primary.jpg");
  });
});
