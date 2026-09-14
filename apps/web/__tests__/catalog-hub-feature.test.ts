import { pickTvHubFeatured } from "@/lib/server/catalog-hub-feature";
import type { MediaItem } from "@/lib/domain/typings";

const tv = (
  id: number,
  vote: number,
  genreIds: number[],
  lang: string,
  backdrop = true,
): MediaItem =>
  ({
    id,
    media_type: "tv",
    name: `Show ${id}`,
    vote_average: vote,
    genre_ids: genreIds,
    original_language: lang,
    backdrop_path: backdrop ? "/b.jpg" : null,
  }) as MediaItem;

describe("pickTvHubFeatured", () => {
  it("skips anime and prefers the most popular live-action pick", () => {
    const picked = pickTvHubFeatured([
      { ...tv(1, 0, [18], "ko"), popularity: 900 },
      { ...tv(2, 8.3, [10759, 16], "ja"), popularity: 50_000 },
      { ...tv(3, 8.3, [18], "en"), popularity: 12_000 },
    ]);
    expect(picked?.id).toBe(3);
  });
});
