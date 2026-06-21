import { buildSearchSuggestions } from "@/lib/search/suggestions";
import { describe, expect, test } from "vitest";

describe("buildSearchSuggestions", () => {
  test("returns empty array for missing items", () => {
    expect(buildSearchSuggestions(undefined)).toEqual([]);
    expect(buildSearchSuggestions([])).toEqual([]);
  });

  test("collects movie, tv, and person names ordered by popularity", () => {
    const suggestions = buildSearchSuggestions([
      {
        media_type: "person",
        name: "Christopher Nolan",
        popularity: 20,
      },
      {
        media_type: "movie",
        title: "Inception",
        popularity: 50,
      },
      {
        media_type: "tv",
        name: "Breaking Bad",
        popularity: 40,
      },
    ]);

    expect(suggestions).toEqual([
      "Inception",
      "Breaking Bad",
      "Christopher Nolan",
    ]);
  });

  test("deduplicates suggestions case-insensitively", () => {
    const suggestions = buildSearchSuggestions([
      { media_type: "movie", title: "Inception", popularity: 10 },
      { media_type: "movie", title: "inception", popularity: 9 },
      { media_type: "tv", name: "INCEPTION", popularity: 8 },
    ]);

    expect(suggestions).toEqual(["Inception"]);
  });

  test("caps suggestions at six items", () => {
    const suggestions = buildSearchSuggestions(
      Array.from({ length: 10 }, (_, index) => ({
        media_type: "movie",
        title: `Title ${index}`,
        popularity: 100 - index,
      })),
    );

    expect(suggestions).toHaveLength(6);
    expect(suggestions[0]).toBe("Title 0");
    expect(suggestions[5]).toBe("Title 5");
  });
});
