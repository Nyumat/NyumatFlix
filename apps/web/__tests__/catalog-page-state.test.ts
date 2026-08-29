import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import { describe, expect, test } from "vitest";

describe("getCatalogLayoutState", () => {
  test("returns hub layout for the default discover landing state", () => {
    const state = getCatalogLayoutState({}, "discover");

    expect(state.isHubLayout).toBe(true);
    expect(state.isResultsLayout).toBe(false);
    expect(state.isDefaultDiscoverView).toBe(true);
  });

  test("returns results layout for explicit results mode", () => {
    const state = getCatalogLayoutState({ mode: "results" }, "discover");

    expect(state.isHubLayout).toBe(false);
    expect(state.isResultsLayout).toBe(true);
  });

  test("returns results layout for filtered discover queries", () => {
    const state = getCatalogLayoutState(
      { with_genres: "28", view: "discover" },
      "discover",
    );

    expect(state.isHubLayout).toBe(false);
    expect(state.isResultsLayout).toBe(true);
    expect(state.isDefaultDiscoverView).toBe(false);
  });

  test("returns results layout for later discover pages", () => {
    const state = getCatalogLayoutState({ page: "2" }, "discover");

    expect(state.isHubLayout).toBe(false);
    expect(state.isResultsLayout).toBe(true);
    expect(state.isFirstPage).toBe(false);
  });

  test("returns results layout for non-discover views", () => {
    const state = getCatalogLayoutState({ view: "trending" }, "trending");

    expect(state.isDiscoverView).toBe(false);
    expect(state.isHubLayout).toBe(false);
    expect(state.isResultsLayout).toBe(true);
  });
});
