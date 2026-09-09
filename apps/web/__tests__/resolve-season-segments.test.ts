import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/anime/anibridge-season-segments", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/anime/anibridge-season-segments")>();
  return {
    ...actual,
    buildAniBridgeSeasonSegments: vi.fn(),
  };
});

vi.mock("@/lib/anime/anibridge-mappings", () => ({
  getAniBridgeMappings: vi.fn(),
}));

vi.mock("@/lib/fribb-mapping", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fribb-mapping")>();
  return {
    ...actual,
    getFribbAnimeList: vi.fn(),
  };
});

vi.mock("@/lib/anime/season-index", () => ({
  getSeasonIndex: vi.fn(),
  getSeasonIndexEntry: vi.fn(),
}));

vi.mock("@/lib/anilist-tv-detail", () => ({
  getCachedAnilistTvMedia: vi.fn(),
}));

import { buildAniBridgeSeasonSegments } from "@/lib/anime/anibridge-season-segments";
import { getAniBridgeMappings } from "@/lib/anime/anibridge-mappings";
import {
  countAniBridgeTmdbSeasons,
  resolveSeasonSegments,
} from "@/lib/anime/resolve-season-segments";
import { getFribbAnimeList } from "@/lib/fribb-mapping";
import { getSeasonIndex, getSeasonIndexEntry } from "@/lib/anime/season-index";

const mockedGetSeasonIndex = getSeasonIndex as ReturnType<typeof vi.fn>;
const mockedGetSeasonIndexEntry = getSeasonIndexEntry as ReturnType<
  typeof vi.fn
>;
const mockedGetAniBridgeMappings = getAniBridgeMappings as ReturnType<
  typeof vi.fn
>;
const mockedBuildAniBridgeSeasonSegments =
  buildAniBridgeSeasonSegments as ReturnType<typeof vi.fn>;
const mockedGetFribbAnimeList = getFribbAnimeList as ReturnType<typeof vi.fn>;

describe("resolveSeasonSegments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSeasonIndex.mockResolvedValue({
      version: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      entries: {},
    });
    mockedGetSeasonIndexEntry.mockResolvedValue(null);
    mockedGetAniBridgeMappings.mockResolvedValue({});
    mockedGetFribbAnimeList.mockResolvedValue([]);
  });

  it("uses the precomputed season index when available", async () => {
    mockedGetSeasonIndexEntry.mockResolvedValue({
      source: "anibridge",
      segments: [
        { startEpisode: 1, endEpisode: 12, anilistMediaId: 21 },
      ],
    });

    const resolved = await resolveSeasonSegments({
      tmdbShowId: 37854,
      seasonNumber: 1,
    });

    expect(resolved.source).toBe("anibridge");
    expect(resolved.segments).toEqual([
      { startEpisode: 1, endEpisode: 12, anilistMediaId: 21 },
    ]);
    expect(mockedBuildAniBridgeSeasonSegments).not.toHaveBeenCalled();
    expect(mockedGetFribbAnimeList).not.toHaveBeenCalled();
    expect(mockedGetAniBridgeMappings).not.toHaveBeenCalled();
  });

  it("prefers AniBridge segments and appends Fribb split-cour beyond the covered range", async () => {
    mockedGetAniBridgeMappings.mockResolvedValue({
      "tmdb_show:1429:s4": {},
      "tmdb_show:1429:s1": {},
    });
    mockedBuildAniBridgeSeasonSegments.mockReturnValue([
      { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
      { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
    ]);
    mockedGetFribbAnimeList.mockResolvedValue([
      {
        anilist_id: 146984,
        themoviedb_id: { tv: 1429 },
        season: { tmdb: 4 },
        episode_offset: { tmdb: 28 },
      },
    ]);

    const resolved = await resolveSeasonSegments({
      tmdbShowId: 1429,
      seasonNumber: 4,
    });

    expect(resolved.source).toBe("anibridge");
    expect(resolved.segments).toEqual([
      { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
      { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
      { startEpisode: 29, endEpisode: 29, anilistMediaId: 146984 },
      { startEpisode: 30, endEpisode: 30, anilistMediaId: 162314 },
    ]);
  });

  it("falls back to Fribb-only segments when AniBridge has no entry", async () => {
    mockedBuildAniBridgeSeasonSegments.mockReturnValue([]);
    mockedGetFribbAnimeList.mockResolvedValue([
      {
        anilist_id: 100240,
        themoviedb_id: { tv: 61374 },
        season: { tmdb: 3 },
      },
      {
        anilist_id: 102351,
        themoviedb_id: { tv: 61374 },
        season: { tmdb: 3 },
        episode_offset: { tmdb: 12 },
      },
    ]);

    const resolved = await resolveSeasonSegments({
      tmdbShowId: 61374,
      seasonNumber: 3,
    });

    expect(resolved.source).toBe("fribb");
    expect(resolved.segments).toEqual([
      { startEpisode: 1, endEpisode: 12, anilistMediaId: 100240 },
      { startEpisode: 13, endEpisode: 13, anilistMediaId: 102351 },
    ]);
  });

  it("extends the tail with known SPECIAL sequel appendix entries", async () => {
    mockedBuildAniBridgeSeasonSegments.mockReturnValue([
      { startEpisode: 1, endEpisode: 1, anilistMediaId: 146984 },
    ]);

    const resolved = await resolveSeasonSegments({
      tmdbShowId: 1429,
      seasonNumber: 4,
    });

    expect(resolved.segments).toEqual([
      { startEpisode: 1, endEpisode: 1, anilistMediaId: 146984 },
      { startEpisode: 2, endEpisode: 2, anilistMediaId: 162314 },
    ]);
  });

  it("preserves heuristic base segments when provided", async () => {
    const resolved = await resolveSeasonSegments({
      tmdbShowId: 999,
      seasonNumber: 1,
      baseSegments: [{ startEpisode: 1, endEpisode: 12, anilistMediaId: 42 }],
    });

    expect(resolved.source).toBe("heuristic");
    expect(resolved.segments[0]).toEqual({
      startEpisode: 1,
      endEpisode: 12,
      anilistMediaId: 42,
    });
  });
});

describe("countAniBridgeTmdbSeasons", () => {
  it("ignores season 0 keys when counting TMDB seasons", () => {
    expect(
      countAniBridgeTmdbSeasons(
        {
          "tmdb_show:1429:s0": {},
          "tmdb_show:1429:s1": {},
          "tmdb_show:1429:s4": {},
        },
        1429,
      ),
    ).toBe(2);
  });
});
