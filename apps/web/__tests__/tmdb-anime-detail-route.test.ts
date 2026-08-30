import { describe, expect, it, vi, beforeEach } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect,
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) =>
      key === "x-search-params" ? "season=2&autoplay=true" : null,
  })),
}));

vi.mock("@/lib/fribb-mapping", () => ({
  getAnilistIdFromFribb: vi.fn(),
}));

vi.mock("@/lib/mal/id-resolver", () => ({
  resolveTmdbToAnilistFromMappings: vi.fn(),
}));

vi.mock("@/utils/anilist-helpers", () => ({
  getAnilistIdForMedia: vi.fn(),
}));

vi.mock("@/lib/server/tvshow-api", () => ({
  fetchTVShowDetails: vi.fn(),
}));

vi.mock("@/lib/media-detail-cache", () => ({
  getCachedMovieDetail: vi.fn(),
}));

import { getAnilistIdFromFribb } from "@/lib/fribb-mapping";
import { resolveTmdbToAnilistFromMappings } from "@/lib/mal/id-resolver";
import { resolveTmdbAnimeDetailRedirects } from "@/lib/server/tmdb-anime-detail-route";

const mockGetAnilistIdFromFribb = getAnilistIdFromFribb as ReturnType<
  typeof vi.fn
>;
const mockResolveTmdbToAnilistFromMappings =
  resolveTmdbToAnilistFromMappings as ReturnType<typeof vi.fn>;

describe("resolveTmdbAnimeDetailRedirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnilistIdFromFribb.mockResolvedValue(null);
    mockResolveTmdbToAnilistFromMappings.mockResolvedValue(null);
  });

  it("ignores non-tmdb anime route IDs", async () => {
    await expect(
      resolveTmdbAnimeDetailRedirects("153567"),
    ).resolves.toBeUndefined();
  });

  it("redirects tmdb-207840 to canonical AniList anime URL when mapped", async () => {
    mockResolveTmdbToAnilistFromMappings.mockResolvedValue(153567);

    await expect(
      resolveTmdbAnimeDetailRedirects("tmdb-207840"),
    ).rejects.toThrow("REDIRECT:/anime/anilist-153567?");
  });

  it("redirects tmdb-movie-1234 to canonical AniList anime URL when mapped", async () => {
    mockGetAnilistIdFromFribb.mockResolvedValue(4321);

    await expect(
      resolveTmdbAnimeDetailRedirects("tmdb-movie-1234"),
    ).rejects.toThrow("REDIRECT:/anime/anilist-4321?");
  });

  it("falls back to standard tvshow route when anime cannot be mapped to AniList", async () => {
    await expect(resolveTmdbAnimeDetailRedirects("tmdb-99999")).rejects.toThrow(
      "REDIRECT:/tvshows/99999?",
    );
  });
});
