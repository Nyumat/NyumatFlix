import {
  buildMergedEpisodesForTmdbSeason,
  groupFranchiseSeasonsByTmdb,
} from "@/lib/anilist-franchise-display";
import type { AniListTvMedia } from "@/lib/anilist-tv-detail";
import type { FribbAnimeRow } from "@/lib/fribb-mapping";
import { describe, expect, it } from "vitest";

const aotFranchiseSeasons = [
  { anilistId: 16498, seasonNumber: 1 },
  { anilistId: 20958, seasonNumber: 2 },
  { anilistId: 99147, seasonNumber: 3 },
  { anilistId: 104578, seasonNumber: 4 },
  { anilistId: 110277, seasonNumber: 5 },
  { anilistId: 131681, seasonNumber: 6 },
] as const;

const aotFribbMapping = {
  16498: { tv: 1429, season: 1 },
  20958: { tv: 1429, season: 2 },
  99147: { tv: 1429, season: 3 },
  104578: { tv: 1429, season: 3 },
  110277: { tv: 1429, season: 4 },
  131681: { tv: 1429, season: 4 },
};

const buildMedia = (id: number, episodes: number): AniListTvMedia => ({
  id,
  type: "ANIME",
  title: { english: `Show ${id}` },
  episodes,
});

const buildEpisodes = (media: AniListTvMedia) =>
  Array.from({ length: media.episodes ?? 0 }, (_, index) => ({
    id: media.id * 10_000 + index + 1,
    name: `Episode ${index + 1}`,
    overview: "",
    episode_number: index + 1,
    air_date: "",
    still_path: null,
    runtime: 24,
    vote_average: 0,
    vote_count: 0,
  }));

describe("groupFranchiseSeasonsByTmdb", () => {
  it("collapses split-cour Attack on Titan entries to four TMDB seasons", () => {
    expect(
      groupFranchiseSeasonsByTmdb(aotFranchiseSeasons, aotFribbMapping, 1429),
    ).toEqual([
      { seasonNumber: 1, anilistIds: [16498] },
      { seasonNumber: 2, anilistIds: [20958] },
      { seasonNumber: 3, anilistIds: [99147, 104578] },
      { seasonNumber: 4, anilistIds: [110277, 131681] },
    ]);
  });

  it("returns null when no TMDB grouping is available", () => {
    expect(
      groupFranchiseSeasonsByTmdb(aotFranchiseSeasons, {}, 1429),
    ).toBeNull();
  });
});

describe("buildMergedEpisodesForTmdbSeason", () => {
  const aotFribbRows: FribbAnimeRow[] = [
    {
      anilist_id: 99147,
      themoviedb_id: { tv: 1429 },
      season: { tmdb: 3 },
    },
    {
      anilist_id: 104578,
      themoviedb_id: { tv: 1429 },
      season: { tmdb: 3 },
      episode_offset: { tmdb: 12 },
    },
  ];

  it("renumbers split-cour episodes into one TMDB season", () => {
    const seasonsByAnilistId = new Map<number, AniListTvMedia>([
      [99147, buildMedia(99147, 12)],
      [104578, buildMedia(104578, 2)],
    ]);

    const episodes = buildMergedEpisodesForTmdbSeason({
      tmdbShowId: 1429,
      seasonNumber: 3,
      anilistIds: [99147, 104578],
      seasonsByAnilistId,
      fribbRows: aotFribbRows,
      buildEpisodes,
    });

    expect(episodes.map((episode) => episode.episode_number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
  });
});
