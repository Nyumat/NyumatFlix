import { beforeEach, describe, expect, it, vi } from "vitest";

import { applySegmentAnimeEpisodeMapping } from "@/lib/anime/apply-segment-episode-mapping";
import { resolveAniBridgePlaybackCoords } from "@/lib/anime/anibridge-mappings";
import { resolveSegmentEpisodeCoords } from "@/lib/anime/resolve-segment-episode-coords";
import { mergeBundledSeasonSegments } from "@/lib/anime/season-segment-merge";
import { resolveAnimePlaybackCoords } from "@/lib/anime/resolve-playback-coords";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import {
  AOT_TMDB_SHOW_ID,
  aotAniBridgeMappings,
  aotBarometerCases,
  aotFribbRows,
} from "./fixtures/aot-mapping-fixtures";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/anilist-tv-detail", () => ({
  getCachedAnilistTvMedia: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/anime/season-index", () => ({
  getSeasonIndex: vi.fn(),
  getSeasonIndexEntry: vi.fn(),
}));

vi.mock("@/lib/anime/anibridge-mappings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/anime/anibridge-mappings")>();
  return {
    ...actual,
    getAniBridgeMappings: vi.fn(),
  };
});

vi.mock("@/lib/fribb-mapping", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fribb-mapping")>();
  return {
    ...actual,
    getFribbAnimeList: vi.fn(),
  };
});

vi.mock("@/lib/scrape/anime/anilist-meta", () => ({
  fetchAnilistMediaMeta: vi.fn().mockResolvedValue({
    genres: ["Action"],
    isAdult: false,
  }),
  peekAnilistMediaMeta: vi.fn().mockReturnValue({
    genres: ["Action"],
    isAdult: false,
  }),
  fetchAnilistIdByMal: vi.fn(),
}));

import { getAniBridgeMappings } from "@/lib/anime/anibridge-mappings";
import { getFribbAnimeList } from "@/lib/fribb-mapping";
import { getSeasonIndex, getSeasonIndexEntry } from "@/lib/anime/season-index";

const mockedGetSeasonIndex = getSeasonIndex as ReturnType<typeof vi.fn>;
const mockedGetSeasonIndexEntry = getSeasonIndexEntry as ReturnType<
  typeof vi.fn
>;
const mockedGetAniBridgeMappings = getAniBridgeMappings as ReturnType<
  typeof vi.fn
>;
const mockedGetFribbAnimeList = getFribbAnimeList as ReturnType<typeof vi.fn>;

const buildAotSeasonSegments = (seasonNumber: number) =>
  mergeBundledSeasonSegments({
    mappings: aotAniBridgeMappings,
    fribbRows: aotFribbRows,
    tmdbShowId: AOT_TMDB_SHOW_ID,
    seasonNumber,
  }).segments;

describe("Attack on Titan playback/map barometer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSeasonIndex.mockResolvedValue({
      version: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      entries: {},
    });
    mockedGetSeasonIndexEntry.mockImplementation(
      async ({
        tmdbShowId,
        seasonNumber,
      }: {
        tmdbShowId: number;
        seasonNumber: number;
      }) => {
        if (tmdbShowId !== AOT_TMDB_SHOW_ID) {
          return null;
        }

        const merged = mergeBundledSeasonSegments({
          mappings: aotAniBridgeMappings,
          fribbRows: aotFribbRows,
          tmdbShowId,
          seasonNumber,
        });

        if (merged.segments.length === 0 || merged.source === "empty") {
          return null;
        }

        return {
          segments: merged.segments,
          source:
            merged.source === "fribb"
              ? ("fribb" as const)
              : ("anibridge" as const),
        };
      },
    );
    mockedGetAniBridgeMappings.mockResolvedValue(aotAniBridgeMappings);
    mockedGetFribbAnimeList.mockResolvedValue(aotFribbRows);
    useEpisodeStore.getState().clearSelectedEpisode();
  });

  it.each(aotBarometerCases)(
    "$label maps TMDB S$seasonNumber E$episodeNumber to anilist $anilistId ep $relativeEpisodeNumber",
    ({ seasonNumber, episodeNumber, anilistId, relativeEpisodeNumber }) => {
      const segments = buildAotSeasonSegments(seasonNumber);
      const anibridgeCoords = resolveAniBridgePlaybackCoords(
        aotAniBridgeMappings,
        AOT_TMDB_SHOW_ID,
        seasonNumber,
        episodeNumber,
      );

      const segmentCoords = resolveSegmentEpisodeCoords({
        segments,
        tmdbEpisodeNumber: episodeNumber,
        anibridgeRelativeEpisode:
          anibridgeCoords?.anilistId === anilistId
            ? anibridgeCoords.relativeEpisode
            : null,
      });

      expect(segmentCoords).toEqual({
        anilistId,
        relativeEpisodeNumber,
        animeSeasonNumber: expect.any(Number),
        segment: expect.objectContaining({
          anilistMediaId: anilistId,
        }),
      });
    },
  );

  it.each(aotBarometerCases)(
    "playback coords agree with map segments for $label",
    async ({
      seasonNumber,
      episodeNumber,
      anilistId,
      relativeEpisodeNumber,
    }) => {
      const playback = await resolveAnimePlaybackCoords({
        tmdbShowId: AOT_TMDB_SHOW_ID,
        seasonNumber,
        episodeNumber,
      });

      expect(playback).not.toBeNull();
      expect(playback?.anilistId).toBe(anilistId);
      expect(playback?.relativeEpisodeNumber).toBe(relativeEpisodeNumber);
    },
  );

  it.each(aotBarometerCases)(
    "client map apply agrees with playback for $label",
    ({ seasonNumber, episodeNumber, anilistId, relativeEpisodeNumber }) => {
      const segments = buildAotSeasonSegments(seasonNumber);

      useEpisodeStore.getState().setDefaultAnilistId(16498);
      useEpisodeStore.getState().setSelectedEpisode(
        {
          id: episodeNumber,
          episode_number: episodeNumber,
          name: `Episode ${episodeNumber}`,
          overview: "",
          still_path: null,
          air_date: "",
          vote_average: 0,
          runtime: null,
        },
        "anilist-16498",
        seasonNumber,
      );

      const applied = applySegmentAnimeEpisodeMapping(segments, episodeNumber, {
        tvShowId: "anilist-16498",
        seasonNumber,
        episodeNumber,
        isAdult: false,
      });

      expect(applied).toBe(true);
      const state = useEpisodeStore.getState();
      expect(state.anilistId).toBe(anilistId);
      expect(state.relativeEpisodeNumber).toBe(relativeEpisodeNumber);
    },
  );

  it("maps S4E28 to Final Season Part 2, not the first special", async () => {
    const playback = await resolveAnimePlaybackCoords({
      tmdbShowId: AOT_TMDB_SHOW_ID,
      seasonNumber: 4,
      episodeNumber: 28,
    });

    expect(playback).toMatchObject({
      anilistId: 131681,
      relativeEpisodeNumber: 12,
    });
  });

  it("maps the two S4 specials to distinct AniList entries", async () => {
    const specialOne = await resolveAnimePlaybackCoords({
      tmdbShowId: AOT_TMDB_SHOW_ID,
      seasonNumber: 4,
      episodeNumber: 29,
    });
    const specialTwo = await resolveAnimePlaybackCoords({
      tmdbShowId: AOT_TMDB_SHOW_ID,
      seasonNumber: 4,
      episodeNumber: 30,
    });

    expect(specialOne).toMatchObject({
      anilistId: 146984,
      relativeEpisodeNumber: 1,
    });
    expect(specialTwo).toMatchObject({
      anilistId: 162314,
      relativeEpisodeNumber: 1,
    });
  });
});
