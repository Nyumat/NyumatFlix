import { afterEach, describe, expect, it, vi } from "vitest";

import { getCachedMediaAboveFoldDetail } from "@/lib/media-above-fold-server";

describe("getCachedMediaAboveFoldDetail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retains the original TMDB title needed for AniList identity", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 261335,
          name: "The Summer When a Boy Became a Man",
          original_name: "少年が大人になった夏",
          first_air_date: "2024-09-06",
          genres: [{ id: 16, name: "Animation" }],
          videos: { results: [] },
        }),
      ),
    );

    const detail = await getCachedMediaAboveFoldDetail("tv", "261335");

    expect(detail).toMatchObject({
      id: 261335,
      name: "The Summer When a Boy Became a Man",
      original_name: "少年が大人になった夏",
    });
  });
});
