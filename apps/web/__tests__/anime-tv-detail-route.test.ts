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

vi.mock("@/lib/anilist-tv-detail", () => ({
  resolveCanonicalAnilistRouteFromFribb: vi.fn(),
}));

vi.mock("@/lib/anilist-movie-route", () => ({
  resolveAnilistMovieTmdbRouteFromFribb: vi.fn(),
}));

vi.mock("@/lib/anime/cross-id-resolver", () => ({
  resolveTmdbShowToAnilistId: vi.fn(),
}));

import { resolveCanonicalAnilistRouteFromFribb } from "@/lib/anilist-tv-detail";
import { resolveAnilistMovieTmdbRouteFromFribb } from "@/lib/anilist-movie-route";
import { resolveTmdbShowToAnilistId } from "@/lib/anime/cross-id-resolver";
import { resolveAnilistTvDetailRedirects } from "@/lib/server/anime-tv-detail-route";

const mockResolveCanonicalAnilistRoute =
  resolveCanonicalAnilistRouteFromFribb as ReturnType<typeof vi.fn>;
const mockResolveAnilistMovieTmdbRoute =
  resolveAnilistMovieTmdbRouteFromFribb as ReturnType<typeof vi.fn>;
const mockResolveTmdbShowToAnilistId = resolveTmdbShowToAnilistId as ReturnType<
  typeof vi.fn
>;

describe("resolveAnilistTvDetailRedirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCanonicalAnilistRoute.mockResolvedValue(null);
    mockResolveAnilistMovieTmdbRoute.mockResolvedValue(null);
    mockResolveTmdbShowToAnilistId.mockResolvedValue(null);
  });

  it("redirects mapped anime movies to TMDB movie detail", async () => {
    mockResolveAnilistMovieTmdbRoute.mockResolvedValue(372058);

    await expect(resolveAnilistTvDetailRedirects("21519")).rejects.toThrow(
      "REDIRECT:/movies/372058?",
    );
  });

  it("redirects legacy bare /anime/{id} URLs to prefixed slugs", async () => {
    await expect(resolveAnilistTvDetailRedirects("154587")).rejects.toThrow(
      "REDIRECT:/anime/anilist-154587?",
    );
  });

  it("keeps prefixed anime ids when already canonical", async () => {
    await expect(
      resolveAnilistTvDetailRedirects("anilist-154587"),
    ).resolves.toBeUndefined();
    expect(mockResolveTmdbShowToAnilistId).not.toHaveBeenCalled();
  });

  it("canonicalizes a prefixed franchise entry from local mappings", async () => {
    mockResolveCanonicalAnilistRoute.mockResolvedValue({
      slug: "anilist-100",
      season: 3,
    });

    await expect(
      resolveAnilistTvDetailRedirects("anilist-200"),
    ).rejects.toThrow("REDIRECT:/anime/anilist-100?");
    expect(mockResolveTmdbShowToAnilistId).not.toHaveBeenCalled();
  });

  it("canonicalizes franchise entries on /anime", async () => {
    mockResolveCanonicalAnilistRoute.mockResolvedValue({
      slug: "anilist-100",
      season: 3,
    });

    await expect(resolveAnilistTvDetailRedirects("200")).rejects.toThrow(
      "REDIRECT:/anime/anilist-100?",
    );
  });

  it("resolves bare TMDB id to canonical AniList anime URL if AniList lookup fails", async () => {
    mockResolveCanonicalAnilistRoute.mockResolvedValue(null);
    mockResolveTmdbShowToAnilistId.mockResolvedValue(153567);

    await expect(resolveAnilistTvDetailRedirects("207840")).rejects.toThrow(
      "REDIRECT:/anime/anilist-153567?",
    );
  });
});
