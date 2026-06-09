import { describe, expect, it } from "vitest";

import { selectBestImdbTrailerId } from "@/lib/imdb-trailer";

const trailer = (id: string, name: string, runtime = 120, season?: number) => ({
  id,
  contentType: { id: "amzn1.imdb.video.contenttype.trailer" },
  name: { value: name },
  runtime: { value: runtime },
  primaryTitle: season
    ? {
        series: {
          displayableEpisodeNumber: {
            displayableSeason: { season },
          },
        },
      }
    : undefined,
});

describe("selectBestImdbTrailerId", () => {
  it("prefers final trailer over teaser", () => {
    const videos = [
      trailer("vi1", "Teaser Trailer", 30),
      trailer("vi2", "Final Trailer", 100),
      trailer("vi3", "Trailer", 90),
    ];
    expect(selectBestImdbTrailerId(videos)).toBe("vi2");
  });

  it("does not treat final season featurettes as theatrical final trailer", () => {
    const videos = [
      trailer("vi1", "A Look At The Final Season", 120, 6),
      trailer("vi2", "Season 6 Official Trailer", 130, 6),
    ];
    expect(selectBestImdbTrailerId(videos)).toBe("vi2");
  });
});
