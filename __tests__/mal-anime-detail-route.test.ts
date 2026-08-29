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

vi.mock("@/lib/mal/id-resolver", () => ({
  resolveMalToTmdb: vi.fn(),
  resolveMalToAnilist: vi.fn(),
}));

import { resolveMalToAnilist, resolveMalToTmdb } from "@/lib/mal/id-resolver";
import { resolveMalAnimeDetailRedirects } from "@/lib/server/mal-anime-detail-route";

const mockResolveMalToTmdb = resolveMalToTmdb as ReturnType<typeof vi.fn>;
const mockResolveMalToAnilist = resolveMalToAnilist as ReturnType<typeof vi.fn>;

describe("resolveMalAnimeDetailRedirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveMalToTmdb.mockResolvedValue(null);
    mockResolveMalToAnilist.mockResolvedValue(null);
  });

  it("redirects mapped TV anime to bare /anime detail", async () => {
    mockResolveMalToTmdb.mockResolvedValue({
      tmdbId: 1429,
      mediaType: "tv",
      season: 1,
      anilistId: 16498,
      malId: 16498,
    });

    await expect(resolveMalAnimeDetailRedirects("mal-16498")).rejects.toThrow(
      "REDIRECT:/anime/16498?",
    );
  });

  it("redirects mapped anime movies to TMDB movie detail", async () => {
    mockResolveMalToTmdb.mockResolvedValue({
      tmdbId: 123,
      mediaType: "movie",
      anilistId: 456,
      malId: 1,
    });

    await expect(resolveMalAnimeDetailRedirects("mal-1")).rejects.toThrow(
      "REDIRECT:/movies/123?",
    );
  });

  it("redirects unmapped MAL entries to AniList anime detail", async () => {
    mockResolveMalToAnilist.mockResolvedValue(188);

    await expect(resolveMalAnimeDetailRedirects("mal-999")).rejects.toThrow(
      "REDIRECT:/anime/188",
    );
  });

  it("returns not found when MAL id cannot be resolved", async () => {
    await expect(resolveMalAnimeDetailRedirects("mal-999")).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});
