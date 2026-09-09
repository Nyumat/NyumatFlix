import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/media-detail-tab-data", () => ({
  getTvSeasonForQuery: vi.fn(),
}));

import { hydrateTvShowDetailQueries } from "@/lib/server/hydrate-tv-show-detail-queries";
import { getTvSeasonForQuery } from "@/lib/server/media-detail-tab-data";
import { queryKeys } from "@/lib/query-keys";
import type { TvShowDetails } from "@/lib/domain/typings";

const mockedGetTvSeasonForQuery = getTvSeasonForQuery as ReturnType<
  typeof vi.fn
>;

describe("hydrateTvShowDetailQueries", () => {
  it("prefetches only the initial season into the tvSeasonRoute query", async () => {
    const queryClient = new QueryClient();
    const details = {
      id: 1429,
      name: "Attack on Titan",
      seasons: [{ season_number: 1, episode_count: 25 }],
    } as TvShowDetails;

    mockedGetTvSeasonForQuery.mockResolvedValue({
      id: 1,
      name: "Season 1",
      overview: "",
      season_number: 1,
      episodes: [
        {
          id: 1,
          name: "Episode 1",
          overview: "",
          episode_number: 1,
          air_date: "",
          still_path: null,
          runtime: null,
          vote_average: 0,
          vote_count: 0,
        },
      ],
    });

    const initialSeasonDetails = await hydrateTvShowDetailQueries(
      queryClient,
      "1429",
      details,
      "tvshows",
      { initialSeasonNumber: 1 },
    );

    expect(mockedGetTvSeasonForQuery).toHaveBeenCalledWith(
      "1429",
      1,
      "tvshows",
    );
    expect(mockedGetTvSeasonForQuery).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKeys.tvSeasonRoute("1429", 1))).toEqual(
      expect.objectContaining({ season_number: 1 }),
    );
    expect(initialSeasonDetails).toEqual({
      1: expect.objectContaining({ season_number: 1 }),
    });
    expect(
      queryClient.getQueryData(queryKeys.tvAllSeasons("1429")),
    ).toBeUndefined();
  });
});
