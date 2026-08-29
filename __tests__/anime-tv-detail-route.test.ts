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
  resolveCanonicalAnilistRoute: vi.fn(),
}));

vi.mock("@/lib/anilist-movie-route", () => ({
  resolveAnilistMovieTmdbRoute: vi.fn(),
}));

vi.mock("@/lib/fribb-mapping", () => ({
  getAnilistIdFromFribb: vi.fn(),
}));

vi.mock("@/lib/mal/id-resolver", () => ({
  resolveTmdbToAnilistFromMappings: vi.fn(),
}));

import { resolveCanonicalAnilistRoute } from "@/lib/anilist-tv-detail";
import { resolveAnilistMovieTmdbRoute } from "@/lib/anilist-movie-route";
import { getAnilistIdFromFribb } from "@/lib/fribb-mapping";
import { resolveTmdbToAnilistFromMappings } from "@/lib/mal/id-resolver";
import { resolveAnilistTvDetailRedirects } from "@/lib/server/anime-tv-detail-route";

const mockResolveCanonicalAnilistRoute =
  resolveCanonicalAnilistRoute as ReturnType<typeof vi.fn>;
const mockResolveAnilistMovieTmdbRoute =
  resolveAnilistMovieTmdbRoute as ReturnType<typeof vi.fn>;
const mockGetAnilistIdFromFribb = getAnilistIdFromFribb as ReturnType<
  typeof vi.fn
>;
const mockResolveTmdbToAnilistFromMappings =
  resolveTmdbToAnilistFromMappings as ReturnType<typeof vi.fn>;

describe("resolveAnilistTvDetailRedirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCanonicalAnilistRoute.mockResolvedValue(null);
    mockResolveAnilistMovieTmdbRoute.mockResolvedValue(null);
    mockGetAnilistIdFromFribb.mockResolvedValue(null);
    mockResolveTmdbToAnilistFromMappings.mockResolvedValue(null);
  });

  it("redirects mapped anime movies to TMDB movie detail", async () => {
    mockResolveAnilistMovieTmdbRoute.mockResolvedValue(372058);

    await expect(resolveAnilistTvDetailRedirects("21519")).rejects.toThrow(
      "REDIRECT:/movies/372058?",
    );
  });

  it("normalizes legacy anilist-* slugs to bare /anime/{id}", async () => {
    await expect(
      resolveAnilistTvDetailRedirects("anilist-154587"),
    ).rejects.toThrow("REDIRECT:/anime/154587?");
  });

  it("does not redirect bare anime ids when already canonical", async () => {
    await expect(
      resolveAnilistTvDetailRedirects("154587"),
    ).resolves.toBeUndefined();
  });

  it("canonicalizes franchise entries on /anime", async () => {
    mockResolveCanonicalAnilistRoute.mockResolvedValue({
      slug: "anilist-100",
      season: 3,
    });

    await expect(resolveAnilistTvDetailRedirects("200")).rejects.toThrow(
      "REDIRECT:/anime/100?",
    );
  });

  it("resolves bare TMDB id to canonical AniList anime URL if AniList lookup fails", async () => {
    mockResolveCanonicalAnilistRoute.mockResolvedValue(null);
    mockResolveTmdbToAnilistFromMappings.mockResolvedValue(153567);

    await expect(resolveAnilistTvDetailRedirects("207840")).rejects.toThrow(
      "REDIRECT:/anime/153567?",
    );
  });
});
