import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchTMDBData } = vi.hoisted(() => ({ fetchTMDBData: vi.fn() }));

vi.mock("@/lib/server/actions", () => ({ fetchTMDBData }));
vi.mock("@/lib/server/enrich-catalog-backdrops", () => ({
  enrichLocalizedCatalogBackdrops: async <T>(items: T[]) => items,
}));

import {
  fetchCountryBrowsePage,
  fetchGenreBrowsePage,
} from "@/lib/server/browse-catalog";

describe("browse catalog queries", () => {
  beforeEach(() => {
    fetchTMDBData.mockReset();
    fetchTMDBData.mockResolvedValue({
      page: 2,
      total_pages: 3,
      total_results: 1,
      results: [],
    });
  });

  it("filters movie genre pages by genre, including later pages", async () => {
    const data = await fetchGenreBrowsePage("28", "movie", 2);

    expect(fetchTMDBData).toHaveBeenCalledWith(
      "/discover/movie",
      expect.objectContaining({
        with_genres: "28",
        sort_by: "vote_average.desc",
        "primary_release_date.lte": expect.any(String),
      }),
      2,
    );
    const [, params] = fetchTMDBData.mock.calls[0] as [
      string,
      Record<string, string>,
      number,
    ];
    expect(params).not.toHaveProperty("region");
    expect(params).not.toHaveProperty("with_origin_country");
    expect(data).toMatchObject({ page: 2, total_pages: 3 });
  });

  it("filters TV genre pages by genre", async () => {
    await fetchGenreBrowsePage("18", "tv");

    expect(fetchTMDBData).toHaveBeenCalledWith(
      "/discover/tv",
      expect.objectContaining({
        with_genres: "18",
        "first_air_date.lte": expect.any(String),
      }),
      1,
    );
  });

  it("keeps country browsing on country filters", async () => {
    await fetchCountryBrowsePage("US", "tv");

    expect(fetchTMDBData).toHaveBeenCalledWith(
      "/discover/tv",
      expect.objectContaining({ with_origin_country: "US" }),
      1,
    );
    const [, params] = fetchTMDBData.mock.calls[0] as [
      string,
      Record<string, string>,
      number,
    ];
    expect(params).not.toHaveProperty("with_genres");
  });
});
