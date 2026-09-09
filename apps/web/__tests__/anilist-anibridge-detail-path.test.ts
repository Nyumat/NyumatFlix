import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const overflowMappings = {
  "tmdb_show:95897:s1": {
    "anilist:113417": { "1-8": "1-8" },
  },
  "anilist:113417": {
    "tmdb_show:95897:s1": { "1-8": "1-8" },
  },
};

vi.mock("@/lib/fribb-mapping", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fribb-mapping")>();
  return {
    ...actual,
    getFribbMapping: async () => ({}),
    getFribbAnimeList: async () => [],
    getAnilistIdFromFribb: async () => null,
    getTmdbIdFromFribb: async () => null,
  };
});

vi.mock("@/lib/anime/anibridge-mappings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/anime/anibridge-mappings")>();
  return {
    ...actual,
    getAniBridgeMappings: async () => overflowMappings,
  };
});

vi.mock("@/lib/anilist-tv-tmdb-enrich", () => ({
  enrichAnilistTvDetailsWithTmdb: async (details: {
    name?: string;
    mappedTmdbTvId?: number | null;
  }) => ({ ...details, mappedTmdbTvId: 95897 }),
  enrichAnilistSeasonDetailsWithTmdb: async (season: unknown) => season,
  getTmdbSeasonEnrichmentContext: async () => null,
  resolveAnilistTmdbTvIdForEnrichment: async () => 95897,
}));

const overflowTmdbShow = {
  id: 95897,
  name: "Overflow",
  original_name: "Overflow",
  overview: "Adult ONA.",
  poster_path: "/overflow.jpg",
  backdrop_path: "/overflow-bd.jpg",
  first_air_date: "2020-01-03",
  vote_average: 6.2,
  vote_count: 40,
  popularity: 20,
  genres: [{ id: 16, name: "Animation" }],
  number_of_episodes: 8,
  number_of_seasons: 1,
  seasons: [
    {
      id: 1,
      name: "Season 1",
      season_number: 1,
      episode_count: 8,
      air_date: "2020-01-03",
      poster_path: "/s1.jpg",
      overview: "",
    },
  ],
};

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  buildResolvedAniListTvShowFromFribb,
  resolveFribbBackedFranchise,
} from "@/lib/anilist-tv-fallback";
import { getCachedAnilistTvAboveFoldDetail } from "@/lib/anilist-tv-detail";

const OVERFLOW_ANILIST_ID = 113417;

describe("anibridge-backed anilist tv detail", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org/3/tv/95897/season/")) {
        return new Response(
          JSON.stringify({
            id: 1,
            name: "Season 1",
            overview: "",
            season_number: 1,
            episodes: Array.from({ length: 8 }, (_, index) => ({
              id: index + 1,
              name: `Episode ${index + 1}`,
              overview: "",
              episode_number: index + 1,
              air_date: "2020-01-03",
              still_path: null,
              runtime: 8,
              vote_average: 0,
              vote_count: 0,
            })),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("api.themoviedb.org/3/tv/95897")) {
        return new Response(JSON.stringify(overflowTmdbShow), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("builds a franchise for Overflow from AniBridge when Fribb has no anilist row", async () => {
    const franchise = await resolveFribbBackedFranchise(OVERFLOW_ANILIST_ID);
    expect(franchise).not.toBeNull();
    expect(franchise?.entryAnilistId).toBe(OVERFLOW_ANILIST_ID);
    expect(franchise?.seasons.map((season) => season.anilistId)).toEqual([
      OVERFLOW_ANILIST_ID,
    ]);
  });

  it("hydrates Overflow detail from TMDB without live AniList", async () => {
    const resolved =
      await buildResolvedAniListTvShowFromFribb(OVERFLOW_ANILIST_ID);
    expect(resolved).not.toBeNull();
    expect(resolved?.entry.id).toBe(OVERFLOW_ANILIST_ID);
    expect(resolved?.entry.title.english).toBe("Overflow");
    expect(resolved?.entry.episodes).toBe(8);
  });

  it("serves above-fold Overflow detail without live AniList", async () => {
    const details = await getCachedAnilistTvAboveFoldDetail(
      `anilist-${OVERFLOW_ANILIST_ID}`,
      { acceptBareNumeric: true },
    );
    expect(details).not.toBeNull();
    expect(details?.name).toBeTruthy();
  });
});
