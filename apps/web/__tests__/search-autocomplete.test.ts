import {
  getSearchAutocompleteItemCount,
  getSearchResultHref,
  resolveSearchAutocompleteSelection,
} from "@/components/search/search-autocomplete";
import type { SearchPreviewResult } from "@/lib/api";
import { describe, expect, test } from "vitest";

describe("search autocomplete helpers", () => {
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
    expect(getSearchAutocompleteItemCount(results)).toBe(2);
  });

  test("includes footer in item count when enabled", () => {
    expect(
      getSearchAutocompleteItemCount(results, {
        includeFooter: true,
      }),
    ).toBe(3);
  });

  test("resolves footer selection only when footer is enabled", () => {
    expect(
      resolveSearchAutocompleteSelection(results, 2, {
        includeFooter: true,
      }),
    ).toEqual({ type: "footer" });

    expect(
      resolveSearchAutocompleteSelection(results, 2, {
        includeFooter: false,
      }),
    ).toBeNull();
  });

  test("uses custom href for AniList routes", () => {
    const animeResult = {
      id: 21222,
      title: "Mankitsu Happening",
      media_type: "tv",
      href: "/anime/21222",
    } as SearchPreviewResult;

    expect(getSearchResultHref(animeResult)).toBe("/anime/21222");
  });
});
