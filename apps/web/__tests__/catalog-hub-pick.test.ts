import {
  pickCriticallyAcclaimedHubFeatured,
  pickMostPopularHubFeatured,
} from "@/lib/catalog-hub-pick";
import type { MediaItem } from "@/lib/domain/typings";

const movie = (
  id: number,
  voteAverage: number,
  popularity: number,
  voteCount: number,
): MediaItem =>
  ({
    id,
    media_type: "movie",
    title: `Movie ${id}`,
    vote_average: voteAverage,
    vote_count: voteCount,
    popularity,
    backdrop_path: "/b.jpg",
  }) as MediaItem;

describe("pickMostPopularHubFeatured", () => {
  it("prefers the highest TMDB popularity among backdrop titles", () => {
    const picked = pickMostPopularHubFeatured([
      movie(1, 8, 100, 1000),
      movie(2, 8, 50_000, 1000),
      movie(3, 8, 200, 1000),
    ]);
    expect(picked?.id).toBe(2);
  });
});

describe("pickCriticallyAcclaimedHubFeatured", () => {
  it("prefers higher vote_average over TMDB popularity", () => {
    const picked = pickCriticallyAcclaimedHubFeatured([
      movie(1, 7.9, 999_999, 10_000),
      movie(2, 8.6, 1, 50_000),
    ]);
    expect(picked?.id).toBe(2);
  });
});
