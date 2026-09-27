import { describe, expect, it } from "vitest";

import { getKisskhKey } from "@/lib/scrape/providers/kisskh-kkey";
import {
  pickKisskhDrama,
  pickKisskhEpisode,
  pickKisskhSearchHits,
} from "@/lib/scrape/providers/kisskh-match";

describe("kisskh matching", () => {
  const hits = [
    { id: 7817, title: "Dangerous Romance" },
    { id: 11511, title: "Dangerous Younger Cousin" },
  ];

  it("keeps exact title matches only", () => {
    expect(pickKisskhSearchHits(hits, "Dangerous Younger Cousin")).toEqual([
      { id: 11511, title: "Dangerous Younger Cousin" },
    ]);
    expect(pickKisskhSearchHits(hits, "Dangerous")).toEqual([]);
  });

  it("prefers a movie listing for movies and a series listing for tv", () => {
    const dramas = [
      {
        id: 1,
        title: "Dangerous Younger Cousin",
        type: "TV",
        episodes: [{ id: 10, number: 1 }],
      },
      {
        id: 11511,
        title: "Dangerous Younger Cousin",
        type: "Movie",
        episodes: [{ id: 192888, number: 1 }],
      },
    ];

    expect(pickKisskhDrama(dramas, "movie")?.id).toBe(11511);
    expect(pickKisskhDrama(dramas, "tv")?.id).toBe(1);
  });

  it("selects episode 1 for movies and the requested episode for tv", () => {
    const episodes = [
      { id: 20, number: 2 },
      { id: 192888, number: 1 },
    ];

    expect(pickKisskhEpisode(episodes, { mediaType: "movie" })?.id).toBe(
      192888,
    );
    expect(
      pickKisskhEpisode(episodes, { mediaType: "tv", episodeNumber: 2 })?.id,
    ).toBe(20);
    expect(
      pickKisskhEpisode(episodes, { mediaType: "tv", episodeNumber: 3 }),
    ).toBeNull();
  });
});

describe("kisskh kkey", () => {
  it("matches the player cipher for a known episode id", () => {
    expect(getKisskhKey({ id: 192888, subOrVid: "vid" })).toBe(
      "84643DA1CCD3EE7E9108A733CB0907401ED59D2E340C7CE4FC786C8309E000D0CC37C109C7760E6D17EB5633E6441FE4504CD100610CA0D5E4BB8B3F73C63D6D1A3A87C4794D10634A95D1B323A351B57749FC2AE69F69643356811DE18466A4B8FD31DFAC871D6D0F8D15BDC35CE8489059B092214EBA43A0216676535CCF68",
    );
  });
});
