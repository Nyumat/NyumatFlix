import { describe, expect, it, vi } from "vitest";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import type { MovieWithMediaType } from "@/tmdb/models";
import { buildPersonalizedHomeResponse } from "@/lib/server/home-personalized";
import { tmdb } from "@/tmdb/api";

const movieDetails = vi.hoisted(
  () =>
    new Map<
      number,
      {
        title: string;
        backdrop_path: string | null;
        poster_path: string | null;
        vote_average: number;
        release_date: string;
      }
    >(),
);

const recommendationResults = vi.hoisted(
  () => new Map<number, MovieWithMediaType[]>(),
);

vi.mock("@/lib/media-detail-cache", () => ({
  getCachedMovieDetail: vi.fn((id: string) =>
    Promise.resolve(movieDetails.get(Number(id)) ?? null),
  ),
  getCachedTvShowDetail: vi.fn(),
}));

vi.mock("@/lib/server/enrich-recently-watched-server", () => ({
  createTvDetailFetcher: vi.fn(() => vi.fn()),
  createServerRecentlyWatchedEnrichmentFetchers: vi.fn(() => ({
    fetchMovie: (contentId: number) =>
      Promise.resolve(movieDetails.get(contentId) ?? null),
    fetchTv: vi.fn(),
    isAnimeTvDetail: vi.fn(() => false),
  })),
}));

vi.mock("@/lib/server/playback-progress", () => ({
  listUserPlaybackProgress: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/server/episode-check-cache", () => ({
  makeEpisodeCheckCacheKey: vi.fn(() => "episode-check"),
  resolveEpisodeCheckForShow: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/tmdb/api", () => ({
  tmdb: {
    movie: {
      recommendations: vi.fn(({ id }: { id: string }) =>
        Promise.resolve({
          results: recommendationResults.get(Number(id)) ?? [],
        }),
      ),
    },
    tv: {
      recommendations: vi.fn(),
    },
  },
}));

const movie = (id: number, title: string): MovieWithMediaType => ({
  id,
  title,
  poster_path: `/${id}.jpg`,
  adult: false,
  overview: "",
  release_date: "2026-01-01",
  genre_ids: [],
  original_title: title,
  original_language: "en",
  backdrop_path: `/${id}-backdrop.jpg`,
  popularity: 1,
  vote_count: 1,
  video: false,
  vote_average: 7,
  media_type: "movie",
});

const watchlistItem = (
  contentId: number,
  lastWatchedAt: string,
): WatchlistItem => ({
  id: `watchlist-${contentId}`,
  userId: "user-1",
  contentId,
  mediaType: "movie",
  status: "watching",
  lastWatchedSeason: null,
  lastWatchedEpisode: null,
  lastWatchedAt: new Date(lastWatchedAt),
  dismissedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date(lastWatchedAt),
});

describe("because you watched personalization", () => {
  it("keeps selectable recommendation seeds for continue-watching titles", async () => {
    movieDetails.set(1, {
      title: "Overflow",
      backdrop_path: "/overflow-backdrop.jpg",
      poster_path: "/overflow.jpg",
      vote_average: 7.4,
      release_date: "2020-01-01",
    });
    movieDetails.set(2, {
      title: "Avatar",
      backdrop_path: "/avatar-backdrop.jpg",
      poster_path: "/avatar.jpg",
      vote_average: 7.6,
      release_date: "2009-01-01",
    });
    movieDetails.set(3, {
      title: "The Runner",
      backdrop_path: "/runner-backdrop.jpg",
      poster_path: "/runner.jpg",
      vote_average: 6.7,
      release_date: "2026-01-01",
    });

    recommendationResults.set(1, [movie(101, "Overflow Recommendation")]);
    recommendationResults.set(2, [movie(102, "Avatar Recommendation")]);
    recommendationResults.set(3, [movie(103, "Runner Recommendation")]);

    const payload = await buildPersonalizedHomeResponse([
      watchlistItem(2, "2026-09-10T12:00:00.000Z"),
      watchlistItem(3, "2026-09-11T12:00:00.000Z"),
      watchlistItem(1, "2026-09-12T12:00:00.000Z"),
    ]);

    const becauseYouWatched = payload.becauseYouWatched;
    expect(becauseYouWatched?.seedTitle).toBe("Overflow");
    expect(becauseYouWatched?.mediaType).toBe("movie");
    if (becauseYouWatched?.mediaType !== "movie") {
      throw new Error("Expected movie recommendations");
    }
    expect(becauseYouWatched.items[0]?.title).toBe("Overflow Recommendation");
    expect(becauseYouWatched.seeds.map((seed) => seed.seedTitle)).toEqual([
      "Overflow",
      "The Runner",
      "Avatar",
    ]);
    expect(tmdb.movie.recommendations).toHaveBeenCalledTimes(3);
  });
});
