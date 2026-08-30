import {
  advanceFribbPlaybackAcrossSpecialSequels,
  appendMappingSegmentsBeyond,
  buildFribbSeasonSegments,
} from "@/lib/anime/split-cour-appendix";
import {
  collectFribbAnilistIdsForTmdbSeason,
  mergeAnilistIdsByFribbOffset,
} from "@/lib/anilist-franchise-display";
import type { FribbAnimeRow } from "@/lib/fribb-mapping";
import { describe, expect, it } from "vitest";

const aotSeason4Rows: FribbAnimeRow[] = [
  {
    anilist_id: 110277,
    themoviedb_id: { tv: 1429 },
    season: { tmdb: 4 },
  },
  {
    anilist_id: 131681,
    themoviedb_id: { tv: 1429 },
    season: { tmdb: 4 },
    episode_offset: { tmdb: 16 },
  },
  {
    anilist_id: 146984,
    themoviedb_id: { tv: 1429 },
    season: { tmdb: 4 },
    episode_offset: { tmdb: 28 },
  },
];

describe("split-cour appendix helpers", () => {
  it("collects all Fribb ids mapped onto the same TMDB season", () => {
    expect(
      collectFribbAnilistIdsForTmdbSeason(aotSeason4Rows, 1429, 4),
    ).toEqual([110277, 131681, 146984]);
  });

  it("merges franchise and Fribb ids in offset order", () => {
    expect(
      mergeAnilistIdsByFribbOffset(
        [110277, 131681],
        collectFribbAnilistIdsForTmdbSeason(aotSeason4Rows, 1429, 4),
        aotSeason4Rows,
      ),
    ).toEqual([110277, 131681, 146984]);
  });

  it("advances Fribb playback into a chained special sequel", () => {
    expect(
      advanceFribbPlaybackAcrossSpecialSequels({
        anilistId: 146984,
        relativeEpisode: 2,
        segmentStart: 29,
        episodeCount: 1,
        sequelSpecialId: 162314,
      }),
    ).toEqual({
      anilistId: 162314,
      relativeEpisode: 1,
      segmentStart: 30,
    });
  });

  it("builds Fribb map segments for Attack on Titan season 4", () => {
    expect(buildFribbSeasonSegments(aotSeason4Rows, 1429, 4)).toEqual([
      { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
      { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
      { startEpisode: 29, endEpisode: 29, anilistMediaId: 146984 },
    ]);
  });

  it("appends Fribb segments beyond AniBridge coverage", () => {
    const anibridge = [
      { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
      { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
    ];

    expect(
      appendMappingSegmentsBeyond(
        anibridge,
        buildFribbSeasonSegments(aotSeason4Rows, 1429, 4),
      ),
    ).toEqual([
      { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
      { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
      { startEpisode: 29, endEpisode: 29, anilistMediaId: 146984 },
    ]);
  });
});
