import type { AniListPage } from "@/lib/anilist-shared";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  kitsu: vi.fn(),
  jikan: vi.fn(),
  enrich: vi.fn(),
}));

vi.mock("@/lib/anime-kitsu-fallback", () => ({
  fetchKitsuAnimeFallbackPageEffect: mocks.kitsu,
}));

vi.mock("@/lib/anime-jikan-fallback", () => ({
  fetchJikanAnimeFallbackPageEffect: mocks.jikan,
}));

vi.mock("@/lib/anilist-tmdb", () => ({
  enrichAniListSearchCatalogItems: mocks.enrich,
}));

import { fetchAniListSearchMedia } from "@/lib/search/anilist-search";

const fallbackPage = (id: number): AniListPage => ({
  pageInfo: {
    currentPage: 1,
    lastPage: 4,
    hasNextPage: true,
    total: 80,
    perPage: 20,
  },
  media: [
    {
      id,
      type: "ANIME",
      format: "TV",
      title: { english: `Anime ${id}` },
      coverImage: { large: `/poster-${id}.jpg` },
    },
  ],
});

const enrichedItem = (id: number) => ({
  id,
  name: `Anime ${id}`,
  title: `Anime ${id}`,
  original_name: `Anime ${id}`,
  original_title: `Anime ${id}`,
  original_language: "ja",
  overview: "",
  poster_path: `/poster-${id}.jpg`,
  backdrop_path: null,
  release_date: "",
  first_air_date: "",
  vote_average: 0,
  vote_count: 0,
  popularity: 0,
  genre_ids: [],
  media_type: "tv" as const,
});

describe("AniList search Effect workflow", () => {
  beforeEach(() => {
    mocks.kitsu.mockReset();
    mocks.jikan.mockReset();
    mocks.enrich.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("enters Kitsu fallback when AniList returns malformed JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 200 })),
    );
    mocks.kitsu.mockReturnValue(Effect.succeed(fallbackPage(10)));
    mocks.jikan.mockReturnValue(Effect.succeed(null));
    mocks.enrich.mockResolvedValue([enrichedItem(10)]);

    const result = await fetchAniListSearchMedia("frieren");

    expect(result.items.map(({ id }) => id)).toEqual([10]);
    expect(mocks.kitsu).toHaveBeenCalledOnce();
    expect(mocks.jikan).not.toHaveBeenCalled();
  });

  it("advances from unusable Kitsu enrichment to Jikan without TMDB", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    mocks.kitsu.mockReturnValue(Effect.succeed(fallbackPage(10)));
    mocks.jikan.mockReturnValue(Effect.succeed(fallbackPage(20)));
    mocks.enrich
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([enrichedItem(20)]);

    const result = await fetchAniListSearchMedia("frieren");

    expect(result.items.map(({ id }) => id)).toEqual([20]);
    expect(mocks.kitsu).toHaveBeenCalledOnce();
    expect(mocks.jikan).toHaveBeenCalledOnce();
  });
});
