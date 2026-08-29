import { queryKeys } from "@/lib/query-keys";
import { describe, expect, test } from "vitest";

describe("queryKeys", () => {
  describe("base keys", () => {
    test("all returns base key array", () => {
      expect(queryKeys.all).toEqual(["nyumatflix"]);
    });
  });

  describe("search keys", () => {
    test("search returns base search key", () => {
      expect(queryKeys.search()).toEqual(["nyumatflix", "search"]);
    });

    test("searchPreview returns key with query", () => {
      expect(queryKeys.searchPreview("batman")).toEqual([
        "nyumatflix",
        "search",
        "preview",
        "batman",
      ]);
    });

    test("searchResults returns key with query and page", () => {
      expect(queryKeys.searchResults("batman", 2)).toEqual([
        "nyumatflix",
        "search",
        "results",
        "batman",
        2,
      ]);
    });
  });

  describe("genre keys", () => {
    test("genres returns base genres key", () => {
      expect(queryKeys.genres()).toEqual(["nyumatflix", "genres"]);
    });

    test("movieGenres returns movie genres key", () => {
      expect(queryKeys.movieGenres()).toEqual([
        "nyumatflix",
        "genres",
        "movie",
      ]);
    });

    test("tvGenres returns TV genres key", () => {
      expect(queryKeys.tvGenres()).toEqual(["nyumatflix", "genres", "tv"]);
    });

    test("combinedGenres returns combined genres key", () => {
      expect(queryKeys.combinedGenres()).toEqual([
        "nyumatflix",
        "genres",
        "combined",
      ]);
    });
  });

  describe("media keys", () => {
    test("media returns base media key", () => {
      expect(queryKeys.media()).toEqual(["nyumatflix", "media"]);
    });

    test("tvSeason returns key with tvId and seasonNumber", () => {
      expect(queryKeys.tvSeason(12345, 2)).toEqual([
        "nyumatflix",
        "media",
        "tv",
        12345,
        "season",
        2,
      ]);
    });

    test("movieDetails returns key with movieId", () => {
      expect(queryKeys.movieDetails(550)).toEqual([
        "nyumatflix",
        "media",
        "movie",
        550,
      ]);
    });

    test("tvDetails returns key with tvId", () => {
      expect(queryKeys.tvDetails(1399)).toEqual([
        "nyumatflix",
        "media",
        "tv",
        1399,
      ]);
    });

    test("mediaAboveFold returns media-specific above-fold key", () => {
      expect(queryKeys.mediaAboveFold("movie", "550")).toEqual([
        "nyumatflix",
        "media",
        "movie",
        "550",
        "above-fold",
      ]);
    });
  });

  describe("key uniqueness", () => {
    test("different search queries have different keys", () => {
      const key1 = queryKeys.searchPreview("batman");
      const key2 = queryKeys.searchPreview("superman");

      expect(key1).not.toEqual(key2);
    });

    test("same search query with different pages have different keys", () => {
      const key1 = queryKeys.searchResults("batman", 1);
      const key2 = queryKeys.searchResults("batman", 2);

      expect(key1).not.toEqual(key2);
    });
  });
});
