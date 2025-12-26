import {
  filterRomanceContent,
  filterZeroRevenueMovies,
  shouldAllowRomanceContent,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { describe, expect, test } from "vitest";

describe("Content Filters", () => {
  describe("filterRomanceContent", () => {
    test("filters out low-rated romance content", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "Low Rated Romance",
          genre_ids: [10749],
          vote_average: 5.0,
          vote_count: 100,
          media_type: "movie",
        },
        {
          id: 2,
          title: "High Rated Romance",
          genre_ids: [10749],
          vote_average: 8.0,
          vote_count: 2000,
          media_type: "movie",
        },
        {
          id: 3,
          title: "Action Movie",
          genre_ids: [28],
          vote_average: 6.0,
          vote_count: 500,
          media_type: "movie",
        },
      ] as MediaItem[];

      const filtered = filterRomanceContent(items);

      expect(filtered).toHaveLength(2);
      expect(filtered.find((item) => item.id === 1)).toBeUndefined();
      expect(filtered.find((item) => item.id === 2)).toBeDefined();
      expect(filtered.find((item) => item.id === 3)).toBeDefined();
    });

    test("filters out low-popularity romance content", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "Unpopular Romance",
          genre_ids: [10749],
          vote_average: 8.0,
          vote_count: 500,
          media_type: "movie",
        },
        {
          id: 2,
          title: "Popular Romance",
          genre_ids: [10749],
          vote_average: 8.0,
          vote_count: 1500,
          media_type: "movie",
        },
      ] as MediaItem[];

      const filtered = filterRomanceContent(items);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(2);
    });

    test("allows romance content that meets both thresholds", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "Good Romance",
          genre_ids: [10749],
          vote_average: 8.0,
          vote_count: 2000,
          media_type: "movie",
        },
      ] as MediaItem[];

      const filtered = filterRomanceContent(items);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    test("allows non-romance content regardless of rating", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "Low Rated Action",
          genre_ids: [28],
          vote_average: 4.0,
          vote_count: 50,
          media_type: "movie",
        },
      ] as MediaItem[];

      const filtered = filterRomanceContent(items);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    test("handles items with genres array instead of genre_ids", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "Romance with genres array",
          genres: [{ id: 10749, name: "Romance" }],
          vote_average: 8.0,
          vote_count: 2000,
          media_type: "movie",
        },
      ] as unknown as MediaItem[];

      const filtered = filterRomanceContent(items);

      expect(filtered).toHaveLength(1);
    });

    test("handles empty array", () => {
      const filtered = filterRomanceContent([]);
      expect(filtered).toEqual([]);
    });
  });

  describe("shouldAllowRomanceContent", () => {
    test("returns true for non-romance content", () => {
      const item = {
        genre_ids: [28],
        vote_average: 5.0,
        vote_count: 100,
      };

      expect(shouldAllowRomanceContent(item)).toBe(true);
    });

    test("returns false for low-rated romance", () => {
      const item = {
        genre_ids: [10749],
        vote_average: 6.0,
        vote_count: 2000,
      };

      expect(shouldAllowRomanceContent(item)).toBe(false);
    });

    test("returns false for low-popularity romance", () => {
      const item = {
        genre_ids: [10749],
        vote_average: 8.0,
        vote_count: 500,
      };

      expect(shouldAllowRomanceContent(item)).toBe(false);
    });

    test("returns true for high-rated, popular romance", () => {
      const item = {
        genre_ids: [10749],
        vote_average: 8.0,
        vote_count: 2000,
      };

      expect(shouldAllowRomanceContent(item)).toBe(true);
    });

    test("handles genres array format", () => {
      const item = {
        genres: [{ id: 10749, name: "Romance" }],
        vote_average: 8.0,
        vote_count: 2000,
      };

      expect(shouldAllowRomanceContent(item)).toBe(true);
    });

    test("handles missing vote data", () => {
      const item = {
        genre_ids: [10749],
      };

      expect(shouldAllowRomanceContent(item)).toBe(false);
    });
  });

  describe("filterZeroRevenueMovies", () => {
    test("filters out released movies with zero revenue", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "No Revenue Released Movie",
          revenue: 0,
          status: "Released",
          media_type: "movie",
        },
        {
          id: 2,
          title: "Profitable Movie",
          revenue: 1000000,
          status: "Released",
          media_type: "movie",
        },
        {
          id: 3,
          title: "TV Show",
          media_type: "tv",
        },
        {
          id: 4,
          title: "Upcoming Movie with Zero Revenue",
          revenue: 0,
          status: "Post Production",
          media_type: "movie",
        },
      ] as unknown as MediaItem[];

      const filtered = filterZeroRevenueMovies(items);

      expect(filtered).toHaveLength(3);
      expect(filtered.find((item) => item.id === 1)).toBeUndefined();
      expect(filtered.find((item) => item.id === 2)).toBeDefined();
      expect(filtered.find((item) => item.id === 3)).toBeDefined();
      expect(filtered.find((item) => item.id === 4)).toBeDefined();
    });

    test("allows movies with positive revenue", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "Blockbuster",
          revenue: 500000000,
          status: "Released",
          media_type: "movie",
        },
      ] as unknown as MediaItem[];

      const filtered = filterZeroRevenueMovies(items);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    test("allows TV shows regardless of revenue", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          name: "TV Show",
          revenue: 0,
          media_type: "tv",
        },
      ] as unknown as MediaItem[];

      const filtered = filterZeroRevenueMovies(items);

      expect(filtered).toHaveLength(1);
    });

    test("handles missing revenue field", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "Movie without revenue",
          media_type: "movie",
        },
      ] as MediaItem[];

      const filtered = filterZeroRevenueMovies(items);

      expect(filtered).toHaveLength(1);
    });

    test("allows upcoming movies even with zero revenue", () => {
      const items: MediaItem[] = [
        {
          id: 1,
          title: "Upcoming Movie",
          revenue: 0,
          status: "In Production",
          media_type: "movie",
        },
      ] as unknown as MediaItem[];

      const filtered = filterZeroRevenueMovies(items);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    test("handles empty array", () => {
      const filtered = filterZeroRevenueMovies([]);
      expect(filtered).toEqual([]);
    });
  });
});
