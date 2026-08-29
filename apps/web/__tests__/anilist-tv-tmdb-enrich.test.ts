import {
  mergeTmdbEpisodesIntoSeason,
  mergeTmdbIntoAnilistTvDetails,
} from "@/lib/anilist-tv-tmdb-enrich";
import type {
  Episode,
  SeasonDetails,
  TvShowDetails,
} from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

const anilistDetails = {
  id: 115138,
  name: "Ane wa Yanmama Junyuu-chuu",
  original_name: "Ane wa Yanmama Junyuu-chuu",
  overview: "",
  poster_path: "/anilist-poster.jpg",
  backdrop_path: "/anilist-poster.jpg",
  first_air_date: "2020-06-05",
  vote_average: 0,
  vote_count: 0,
  popularity: 0,
  adult: true,
  genre_ids: [16],
  genres: [{ id: 16000, name: "Hentai" }],
  seasons: [],
  networks: [],
  production_countries: [{ iso_3166_1: "JP", name: "Japan" }],
  created_by: [],
  content_ratings: { results: [] },
  status: "Ended",
  type: "Scripted",
  origin_country: ["JP"],
  original_language: "ja",
  number_of_seasons: 1,
  number_of_episodes: 2,
  episode_run_time: [16],
  videos: { results: [] },
  credits: { cast: [], crew: [] },
  recommendations: { results: [] },
  similar: { results: [] },
  reviews: { results: [], page: 1, total_pages: 0, total_results: 0 },
} as TvShowDetails;

const tmdbDetails = {
  ...anilistDetails,
  id: 104602,
  overview:
    "After Takuya's older stepsister Aika had some troubles with her husband...",
  backdrop_path: "/tmdb-backdrop.jpg",
  poster_path: "/tmdb-poster.jpg",
  vote_average: 8.2,
  vote_count: 28,
} as TvShowDetails;

describe("mergeTmdbIntoAnilistTvDetails", () => {
  it("prefers TMDB backdrop when AniList reused poster as backdrop", () => {
    const merged = mergeTmdbIntoAnilistTvDetails(anilistDetails, tmdbDetails);
    expect(merged.overview).toContain("Takuya");
    expect(merged.backdrop_path).toBe("/tmdb-backdrop.jpg");
    expect(merged.id).toBe(115138);
    expect(merged.name).toBe("Ane wa Yanmama Junyuu-chuu");
    expect(merged.vote_average).toBe(8.2);
  });

  it("prefers TMDB backdrop over a distinct AniList banner image", () => {
    const merged = mergeTmdbIntoAnilistTvDetails(
      {
        ...anilistDetails,
        backdrop_path:
          "https://s4.anilist.co/file/anilistcdn/media/anime/banner/196187-Z9dV6uotmKjM.jpg",
        poster_path:
          "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx196187.jpg",
      } as TvShowDetails,
      tmdbDetails,
    );

    expect(merged.backdrop_path).toBe("/tmdb-backdrop.jpg");
  });

  it("merges TMDB external_ids so hero Videasy trailers can resolve", () => {
    const merged = mergeTmdbIntoAnilistTvDetails(anilistDetails, {
      ...tmdbDetails,
      external_ids: { imdb_id: "tt37614297" },
    } as TvShowDetails);

    expect(merged.external_ids?.imdb_id).toBe("tt37614297");
    expect((merged as { imdb_id?: string }).imdb_id).toBe("tt37614297");
  });

  it("prefers TMDB episode totals over inflated AniList placeholders", () => {
    const merged = mergeTmdbIntoAnilistTvDetails(
      {
        ...anilistDetails,
        number_of_episodes: 12,
        seasons: [
          {
            season_number: 1,
            episode_count: 12,
            name: "Season 1",
            id: 1,
            overview: "",
            poster_path: null,
            air_date: null,
          },
        ],
      } as TvShowDetails,
      {
        ...tmdbDetails,
        number_of_episodes: 6,
        seasons: [
          {
            season_number: 1,
            episode_count: 6,
            name: "Season 1",
            id: 1,
            overview: "",
            poster_path: null,
            air_date: null,
          },
        ],
      } as TvShowDetails,
    );

    expect(merged.number_of_episodes).toBe(6);
    expect(merged.seasons[0]?.episode_count).toBe(6);
  });
});

describe("mergeTmdbEpisodesIntoSeason", () => {
  it("replaces placeholder AniList episodes with the TMDB episode list", () => {
    const placeholderEpisodes: Episode[] = Array.from(
      { length: 12 },
      (_, index) => ({
        id: index + 1,
        name: `Episode ${index + 1}`,
        overview: "",
        episode_number: index + 1,
        air_date: "2025-01-01",
        still_path: "/shared.jpg",
        runtime: 16,
        vote_average: 0,
        vote_count: 0,
      }),
    );

    const tmdbEpisodes: Episode[] = Array.from({ length: 6 }, (_, index) => ({
      id: 100 + index,
      name: `Chapter ${index + 1}`,
      overview: `Overview ${index + 1}`,
      episode_number: index + 1,
      air_date: `2025-0${index + 1}-01`,
      still_path: `/ep-${index + 1}.jpg`,
      runtime: 17,
      vote_average: 7,
      vote_count: 3,
    }));

    const season: SeasonDetails = {
      id: 1,
      name: "Season 1",
      overview: "",
      season_number: 1,
      episodes: placeholderEpisodes,
    };

    const merged = mergeTmdbEpisodesIntoSeason(season, tmdbEpisodes);
    expect(merged.episodes).toHaveLength(6);
    expect(merged.episodes[0]?.still_path).toBe("/ep-1.jpg");
    expect(merged.episodes[5]?.name).toBe("Chapter 6");
  });
});
