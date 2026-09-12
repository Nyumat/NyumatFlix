import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchAniListGraphql = vi.fn();
vi.mock("@/lib/anilist-graphql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/anilist-graphql")>();
  return {
    ...actual,
    fetchAniListGraphql: (...args: unknown[]) => fetchAniListGraphql(...args),
  };
});

const aotTmdbShow = {
  id: 1429,
  name: "Attack on Titan",
  original_name: "Shingeki no Kyojin",
  overview: "Centuries ago, mankind was slaughtered to near extinction...",
  poster_path: "/aot-poster.jpg",
  backdrop_path: "/aot-backdrop.jpg",
  first_air_date: "2013-04-07",
  vote_average: 8.7,
  vote_count: 1000,
  popularity: 500,
  genres: [{ id: 16, name: "Animation" }],
  number_of_episodes: 87,
  seasons: [
    {
      id: 1,
      name: "Season 1",
      season_number: 1,
      episode_count: 25,
      air_date: "2013-04-07",
      poster_path: "/s1.jpg",
      overview: "Season 1 overview",
    },
  ],
};

vi.mock("@/lib/anilist-tv-tmdb-enrich", () => ({
  enrichAnilistTvDetailsWithTmdb: async (details: { name?: string }) => details,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  buildResolvedAniListTvShowFromFribb,
  resolveFribbBackedFranchise,
} from "@/lib/anilist-tv-fallback";
import { getCachedAnilistTvAboveFoldDetail } from "@/lib/anilist-tv-detail";

const AOT_ANILIST_ID = 16498;

describe("fribb-first anilist tv detail", () => {
  beforeEach(() => {
    fetchAniListGraphql.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org")) {
        return new Response(JSON.stringify(aotTmdbShow), {
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

  it("builds a fribb-backed franchise for mapped attack on titan", async () => {
    const franchise = await resolveFribbBackedFranchise(AOT_ANILIST_ID);
    expect(franchise).not.toBeNull();
    expect(franchise?.entryAnilistId).toBe(AOT_ANILIST_ID);
    expect(franchise?.seasons.length).toBeGreaterThan(1);
  });

  it("resolves attack on titan from fribb without live anilist graphql", async () => {
    const resolved = await buildResolvedAniListTvShowFromFribb(AOT_ANILIST_ID);
    expect(resolved).not.toBeNull();
    expect(resolved?.entry.id).toBe(AOT_ANILIST_ID);
    expect(fetchAniListGraphql).not.toHaveBeenCalled();
  });

  it("serves above-fold detail from fribb for mapped anilist routes", async () => {
    const aboveFold = await getCachedAnilistTvAboveFoldDetail(
      `anilist-${AOT_ANILIST_ID}`,
    );
    expect(aboveFold).not.toBeNull();
    expect(aboveFold?.name).toBeTruthy();
    expect(fetchAniListGraphql).not.toHaveBeenCalled();
  });

  it("returns null franchise for unmapped anilist ids", async () => {
    const franchise = await resolveFribbBackedFranchise(9_999_999);
    expect(franchise).toBeNull();
  });
});
