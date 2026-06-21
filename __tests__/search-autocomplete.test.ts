import {
  getSearchAutocompleteItemCount,
  resolveSearchAutocompleteSelection,
} from "@/components/search/search-autocomplete";
import type { SearchPreviewResult } from "@/lib/api";
import { describe, expect, test } from "vitest";

describe("search autocomplete helpers", () => {
  const suggestions = ["Inception", "Interstellar"];
  const results = [
    {
      id: 1,
      title: "Inception",
      media_type: "movie",
      href: "/movies/1",
    },
    {
      id: 2,
      name: "Breaking Bad",
      media_type: "tv",
      href: "/tvshows/2",
    },
  ] as SearchPreviewResult[];

  test("excludes footer from item count by default", () => {
    expect(getSearchAutocompleteItemCount(suggestions, results)).toBe(4);
  });

  test("includes footer in item count when enabled", () => {
    expect(
      getSearchAutocompleteItemCount(suggestions, results, {
        includeFooter: true,
      }),
    ).toBe(5);
  });

  test("resolves footer selection only when footer is enabled", () => {
    expect(
      resolveSearchAutocompleteSelection(suggestions, results, 4, {
        includeFooter: true,
      }),
    ).toEqual({ type: "footer" });

    expect(
      resolveSearchAutocompleteSelection(suggestions, results, 4, {
        includeFooter: false,
      }),
    ).toBeNull();
  });
});
