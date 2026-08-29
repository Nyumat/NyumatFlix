import { describe, expect, it } from "vitest";

import {
  mergeBidirectionalSeasonChain,
  pickAnilistIdFromSeasonChain,
} from "@/lib/anilist-franchise";
import {
  buildKitsuEpisodeThumbnailMap,
  pickKitsuAnimeFromSearch,
} from "@/lib/anime/kitsu-episode-thumbnails";

describe("kitsu episode thumbnails", () => {
  it("prefers an exact canonical title match from Kitsu search", () => {
    const results = [
      {
        id: 46903,
        canonicalTitle: "BLEACH: Sennen Kessen-hen - Ketsubetsu-tan",
      },
      { id: 43078, canonicalTitle: "BLEACH: Sennen Kessen-hen" },
    ];

    expect(
      pickKitsuAnimeFromSearch(results, {
        romaji: "BLEACH: Sennen Kessen-hen",
        english: "BLEACH: Thousand-Year Blood War",
      }),
    ).toEqual({
      id: 43078,
      canonicalTitle: "BLEACH: Sennen Kessen-hen",
    });
  });

  it("builds episode-number keyed thumbnail maps", () => {
    expect(
      buildKitsuEpisodeThumbnailMap([
        { number: 1, thumbnailUrl: "https://media.kitsu.app/ep1.jpg" },
        { number: 2, thumbnailUrl: "https://media.kitsu.app/ep2.jpg" },
      ]),
    ).toEqual({
      1: "https://media.kitsu.app/ep1.jpg",
      2: "https://media.kitsu.app/ep2.jpg",
    });
  });
});

describe("anilist franchise season chain", () => {
  it("maps TMDB season numbers onto a forward sequel chain", () => {
    const chain = mergeBidirectionalSeasonChain(
      [],
      [116674, 159322, 169755, 185874],
      4,
    );

    expect(pickAnilistIdFromSeasonChain(chain, 1)).toBe(116674);
    expect(pickAnilistIdFromSeasonChain(chain, 2)).toBe(159322);
    expect(pickAnilistIdFromSeasonChain(chain, 4)).toBe(185874);
  });

  it("prepends prequels when the entry is not the first cour", () => {
    const chain = mergeBidirectionalSeasonChain(
      [116674],
      [159322, 169755, 185874],
      4,
    );

    expect(chain).toEqual([116674, 159322, 169755, 185874]);
    expect(pickAnilistIdFromSeasonChain(chain, 1)).toBe(116674);
    expect(pickAnilistIdFromSeasonChain(chain, 2)).toBe(159322);
  });
});
