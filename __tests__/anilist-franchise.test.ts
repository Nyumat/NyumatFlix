import {
  AnilistFranchiseFetchError,
  areAnimeFranchiseTitlesCompatible,
  buildFranchiseFromSeasonIds,
  collectForwardSequelChain,
  isAnilistFranchiseFetchError,
  isSeasonChainRelationNode,
  pickCachedFranchiseFallback,
  stripSeasonSuffix,
} from "@/lib/anilist-franchise";
import {
  collectFribbTmdbFranchiseSeasonIds,
  malAnimeToRelationMedia,
} from "@/lib/anilist-franchise-fallback";
import type { FribbAnimeRow } from "@/lib/fribb-mapping";
import { describe, expect, it } from "vitest";

describe("stripSeasonSuffix", () => {
  it("removes trailing season labels from titles", () => {
    expect(
      stripSeasonSuffix(
        "The 100 Girlfriends Who Really, Really, Really, Really, REALLY Love You Season 3",
      ),
    ).toBe(
      "The 100 Girlfriends Who Really, Really, Really, Really, REALLY Love You",
    );
    expect(stripSeasonSuffix("Frieren: Beyond Journey's End 2nd Season")).toBe(
      "Frieren: Beyond Journey's End",
    );
  });
});

describe("areAnimeFranchiseTitlesCompatible", () => {
  it("keeps titled sequel seasons in the same chain", () => {
    expect(
      areAnimeFranchiseTitlesCompatible(
        { english: "Jujutsu Kaisen" },
        { english: "Jujutsu Kaisen 2nd Season" },
      ),
    ).toBe(true);
  });

  it("rejects an unrelated AniList sequel relation", () => {
    expect(
      areAnimeFranchiseTitlesCompatible(
        { english: "One Piece", romaji: "ONE PIECE" },
        {
          english: "MONSTERS: 103 Mercies Dragon Damnation",
          romaji: "MONSTERS: Ippyaku Sanjou Hiryuu Jigoku",
        },
      ),
    ).toBe(false);
  });
});

describe("collectForwardSequelChain", () => {
  const sequelNode = (id: number, english: string) => ({
    id,
    type: "ANIME",
    format: "TV",
    title: { english },
    seasonYear: 2020 + id,
  });

  const mediaById = new Map([
    [
      1,
      {
        id: 1,
        format: "TV",
        title: { english: "Show" },
        relations: {
          edges: [
            { relationType: "SEQUEL", node: sequelNode(2, "Show Season 2") },
          ],
        },
      },
    ],
    [
      2,
      {
        id: 2,
        format: "TV",
        title: { english: "Show Season 2" },
        relations: { edges: [] },
      },
    ],
  ]);

  it("walks sequel relations to the end of the chain", async () => {
    const chain = await collectForwardSequelChain(
      1,
      async (id) => mediaById.get(id) ?? null,
    );
    expect(chain).toEqual([1, 2]);
  });

  it("propagates transient fetch failures instead of silently truncating", async () => {
    // Silent truncation used to get cached as the "real" chain, hiding whole
    // seasons (e.g. AOT showing 3 of 4 seasons) for the full cache TTL.
    const failingFetch = async (id: number) => {
      if (id === 2) {
        throw new AnilistFranchiseFetchError("rate limited");
      }
      return mediaById.get(id) ?? null;
    };

    await expect(
      collectForwardSequelChain(1, failingFetch),
    ).rejects.toBeInstanceOf(AnilistFranchiseFetchError);
  });
});

describe("isSeasonChainRelationNode", () => {
  it("keeps mainline TV seasons in the chain", () => {
    expect(
      isSeasonChainRelationNode({ id: 20958, type: "ANIME", format: "TV" }),
    ).toBe(true);
    expect(
      isSeasonChainRelationNode({ id: 1, type: "ANIME", format: "ONA" }),
    ).toBe(true);
    expect(
      isSeasonChainRelationNode({ id: 2, type: "ANIME", format: null }),
    ).toBe(true);
  });

  it("rejects side-story OVAs marked as PREQUEL of the main series", () => {
    // Attack on Titan: No Regrets (20811) is an OVA that AniList lists as a
    // PREQUEL of Attack on Titan (16498). It must never become the
    // franchise root or a numbered season.
    expect(
      isSeasonChainRelationNode({ id: 20811, type: "ANIME", format: "OVA" }),
    ).toBe(false);
    expect(
      isSeasonChainRelationNode({ id: 3, type: "ANIME", format: "MOVIE" }),
    ).toBe(false);
    expect(
      isSeasonChainRelationNode({ id: 4, type: "ANIME", format: "SPECIAL" }),
    ).toBe(false);
  });
});

describe("isAnilistFranchiseFetchError", () => {
  it("matches serialized errors by name after unstable_cache", () => {
    const wrapped = new Error("AniList relation fetch returned 429 for 20923");
    wrapped.name = "AnilistFranchiseFetchError";
    expect(isAnilistFranchiseFetchError(wrapped)).toBe(true);
    expect(isAnilistFranchiseFetchError(new Error("unrelated"))).toBe(false);
  });
});

describe("collectFribbTmdbFranchiseSeasonIds", () => {
  const aotRows: FribbAnimeRow[] = [
    { anilist_id: 16498, themoviedb_id: { tv: 1429 }, season: { tmdb: 1 } },
    { anilist_id: 20958, themoviedb_id: { tv: 1429 }, season: { tmdb: 2 } },
    { anilist_id: 99147, themoviedb_id: { tv: 1429 }, season: { tmdb: 3 } },
    {
      anilist_id: 104578,
      themoviedb_id: { tv: 1429 },
      season: { tmdb: 3 },
      episode_offset: { tmdb: 12 },
    },
    { anilist_id: 110277, themoviedb_id: { tv: 1429 }, season: { tmdb: 4 } },
    {
      anilist_id: 131681,
      themoviedb_id: { tv: 1429 },
      season: { tmdb: 4 },
      episode_offset: { tmdb: 16 },
    },
    { anilist_id: 20811, themoviedb_id: { movie: 321528 } },
  ];

  it("orders split-cour Attack on Titan ids by TMDB season then offset", () => {
    expect(collectFribbTmdbFranchiseSeasonIds(aotRows, 20958)).toEqual([
      16498, 20958, 99147, 104578, 110277, 131681,
    ]);
  });

  it("ignores movie-only Fribb rows that share a franchise name", () => {
    const ids = collectFribbTmdbFranchiseSeasonIds(aotRows, 16498);
    expect(ids).not.toContain(20811);
  });
});

describe("malAnimeToRelationMedia", () => {
  it("rewrites MAL prequel/sequel edges onto AniList ids", () => {
    const media = malAnimeToRelationMedia(
      20958,
      {
        id: 25777,
        title: "Shingeki no Kyojin Season 2",
        media_type: "tv",
        alternative_titles: { en: "Attack on Titan Season 2" },
        start_season: { year: 2017, season: "spring" },
        related_anime: [
          {
            relation_type: "prequel",
            node: {
              id: 16498,
              title: "Shingeki no Kyojin",
              media_type: "tv",
              alternative_titles: { en: "Attack on Titan" },
              start_season: { year: 2013, season: "spring" },
            },
          },
          {
            relation_type: "sequel",
            node: {
              id: 35760,
              title: "Shingeki no Kyojin Season 3",
              media_type: "tv",
              alternative_titles: { en: "Attack on Titan Season 3" },
              start_season: { year: 2018, season: "summer" },
            },
          },
          {
            relation_type: "side_story",
            node: { id: 18397, title: "Shingeki no Kyojin: Kuinaki Sentaku" },
          },
        ],
      },
      new Map([
        [25777, 20958],
        [16498, 16498],
        [35760, 99147],
      ]),
    );

    expect(media.id).toBe(20958);
    expect(media.format).toBe("TV");
    expect(
      media.relations?.edges?.map((edge) => [edge.relationType, edge.node?.id]),
    ).toEqual([
      ["PREQUEL", 16498],
      ["SEQUEL", 99147],
    ]);
  });
});

describe("pickCachedFranchiseFallback", () => {
  it("prefers a multi-season TMDB/Fribb chain over MAL", () => {
    const picked = pickCachedFranchiseFallback(
      20958,
      [16498, 20958, 99147],
      buildFranchiseFromSeasonIds(20958, [20958, 99147]),
    );
    expect(picked?.seasons.map((season) => season.anilistId)).toEqual([
      16498, 20958, 99147,
    ]);
    expect(picked?.entrySeasonNumber).toBe(2);
  });

  it("uses MAL when Fribb only knows the current season", () => {
    const picked = pickCachedFranchiseFallback(
      20958,
      [20958],
      buildFranchiseFromSeasonIds(20958, [16498, 20958]),
    );
    expect(picked?.seasons.map((season) => season.anilistId)).toEqual([
      16498, 20958,
    ]);
  });

  it("refuses a 1-season result so we don't cache a truncated chain", () => {
    expect(
      pickCachedFranchiseFallback(
        20958,
        [20958],
        buildFranchiseFromSeasonIds(20958, [20958]),
      ),
    ).toBeNull();
  });
});
