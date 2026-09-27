import { describe, expect, it } from "vitest";
import { buildAniListTvMediaStubFromTmdb } from "@/lib/anilist-tv-stub";
import type { TvShowDetails } from "@/lib/domain/typings";

const aotTmdbShow = {
  id: 1429,
  name: "Attack on Titan",
  original_name: "Shingeki no Kyojin",
  overview: "Centuries ago, mankind was slaughtered to near extinction...",
  poster_path: "/aot-poster.jpg",
  backdrop_path: "/aot-backdrop.jpg",
  first_air_date: "2013-04-07",
  vote_average: 8.7,
  vote_count: 1000,
  popularity: 500,
  genres: [{ id: 16, name: "Animation" }],
  number_of_episodes: 87,
  seasons: [
    {
      id: 1,
      name: "Season 1",
      season_number: 1,
      episode_count: 25,
      air_date: "2013-04-07",
      poster_path: "/s1.jpg",
      overview: "Season 1 overview",
    },
    {
      id: 4,
      name: "The Final Season",
      season_number: 4,
      episode_count: 28,
      air_date: "2020-12-07",
      poster_path: "/s4.jpg",
      overview: "Final season overview",
    },
  ],
} as TvShowDetails;

describe("buildAniListTvMediaStubFromTmdb", () => {
  it("fills AniList-shaped media from TMDB show and Fribb season row", () => {
    const stub = buildAniListTvMediaStubFromTmdb(16498, aotTmdbShow, {
      anilist_id: 16498,
      themoviedb_id: { tv: 1429 },
      season: { tmdb: 1 },
    });

    expect(stub.id).toBe(16498);
    expect(stub.title.english).toBe("Attack on Titan");
    expect(stub.episodes).toBe(25);
    expect(stub.averageScore).toBe(87);
    expect(stub.coverImage?.large).toBe("/s1.jpg");
  });

  it("uses show-level data when no Fribb row is available", () => {
    const stub = buildAniListTvMediaStubFromTmdb(16498, aotTmdbShow, undefined);

    expect(stub.title.english).toBe("Attack on Titan");
    expect(stub.episodes).toBe(87);
  });

  it("prefers the TMDB show name over arc-style season names", () => {
    const lordOfMysteriesShow = {
      ...aotTmdbShow,
      id: 232230,
      name: "Lord of Mysteries",
      original_name: "诡秘之主",
      number_of_episodes: 13,
      seasons: [
        {
          id: 1,
          name: "The Clown",
          season_number: 1,
          episode_count: 13,
          air_date: "2025-01-01",
          poster_path: "/lom-s1.jpg",
          overview: "Arc one overview",
        },
      ],
    } as TvShowDetails;

    const stub = buildAniListTvMediaStubFromTmdb(137667, lordOfMysteriesShow, {
      anilist_id: 137667,
      themoviedb_id: { tv: 232230 },
      season: { tmdb: 1 },
    });

    expect(stub.title.english).toBe("Lord of Mysteries");
    expect(stub.episodes).toBe(13);
    expect(stub.coverImage?.large).toBe("/lom-s1.jpg");
  });
});
