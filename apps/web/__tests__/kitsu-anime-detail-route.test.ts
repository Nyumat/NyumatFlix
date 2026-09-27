import { describe, expect, it, vi, beforeEach } from "vitest";

const { redirect, notFound } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect,
  notFound,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) =>
      key === "x-search-params" ? "season=2&autoplay=true" : null,
  })),
}));

vi.mock("@/lib/kitsu/detail", () => ({
  readKitsuAnimeById: vi.fn(),
}));

import { readKitsuAnimeById } from "@/lib/kitsu/detail";
import { resolveKitsuAnimeDetailRedirects } from "@/lib/server/kitsu-anime-detail-route";

const mockReadKitsuAnimeById = readKitsuAnimeById as ReturnType<typeof vi.fn>;

describe("resolveKitsuAnimeDetailRedirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects mapped kitsu routes to canonical AniList detail pages", async () => {
    mockReadKitsuAnimeById.mockResolvedValue({
      item: { id: "48233", type: "anime", attributes: {} },
      anilistId: 137667,
      malId: 49818,
    });

    await expect(
      resolveKitsuAnimeDetailRedirects("kitsu-48233"),
    ).rejects.toThrow("REDIRECT:/anime/anilist-137667?");
  });

  it("keeps unmapped kitsu-only titles on the kitsu slug", async () => {
    mockReadKitsuAnimeById.mockResolvedValue({
      item: { id: "99999", type: "anime", attributes: {} },
      anilistId: null,
      malId: null,
    });

    await expect(
      resolveKitsuAnimeDetailRedirects("kitsu-99999"),
    ).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("404s when Kitsu has no record for the slug", async () => {
    mockReadKitsuAnimeById.mockResolvedValue(null);

    await expect(
      resolveKitsuAnimeDetailRedirects("kitsu-48233"),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("ignores non-kitsu route ids", async () => {
    await expect(
      resolveKitsuAnimeDetailRedirects("anilist-137667"),
    ).resolves.toBeUndefined();
    expect(mockReadKitsuAnimeById).not.toHaveBeenCalled();
  });
});
