import {
  pickHeroBackdropPath,
  pickLocalizedCatalogBackdropPath,
} from "@/lib/catalog-hub-backdrop";

describe("pickLocalizedCatalogBackdropPath", () => {
  it("prefers an English localized wide backdrop over textless art", () => {
    const picked = pickLocalizedCatalogBackdropPath({
      backdrop_path: "/textless.jpg",
      images: {
        backdrops: [
          {
            file_path: "/textless.jpg",
            width: 1920,
            height: 1080,
            aspect_ratio: 16 / 9,
            iso_639_1: "",
            vote_average: 5,
            vote_count: 1,
          },
          {
            file_path: "/localized.jpg",
            width: 1920,
            height: 1080,
            aspect_ratio: 16 / 9,
            iso_639_1: "en",
            vote_average: 4,
            vote_count: 1,
          },
        ],
      },
    });

    expect(picked).toEqual({
      path: "/localized.jpg",
      localized: true,
    });
  });

  it("falls back to the hero picker when no localized backdrop exists", () => {
    const picked = pickLocalizedCatalogBackdropPath({
      backdrop_path: "/textless.jpg",
      images: {
        backdrops: [
          {
            file_path: "/textless.jpg",
            width: 1920,
            height: 1080,
            aspect_ratio: 16 / 9,
            iso_639_1: "",
            vote_average: 5,
            vote_count: 1,
          },
        ],
      },
    });

    expect(picked).toEqual({
      path: "/textless.jpg",
      localized: false,
    });
  });
});

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
