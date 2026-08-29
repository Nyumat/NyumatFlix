import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaItem } from "@/lib/domain/typings";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";

describe("getAnilistIdForMedia", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses an exact original-title match when the translated title is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        variables: { search: string };
      };

      const media =
        body.variables.search === "少年が大人になった夏"
          ? {
              id: 177856,
              title: {
                english: null,
                romaji: "Shounen ga Otona ni Natta Natsu",
                native: "少年が大人になった夏",
              },
              startDate: { year: 2024 },
            }
          : null;

      return new Response(JSON.stringify({ data: { Media: media } }));
    });

    const media = {
      id: 261335,
      name: "The Summer When a Boy Became a Man",
      original_name: "少年が大人になった夏",
      first_air_date: "2024-09-06",
      genre_ids: [],
      genres: [{ id: 16, name: "Animation" }],
    } as unknown as MediaItem;

    await expect(getAnilistIdForMedia(media)).resolves.toBe(177856);
  });

  it("rejects an exact title from the wrong release year", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            Media: {
              id: 123,
              title: { english: "Shared Title" },
              startDate: { year: 2020 },
            },
          },
        }),
      ),
    );

    const media = {
      id: 1,
      name: "Shared Title",
      first_air_date: "2024-01-01",
      genre_ids: [16],
    } as unknown as MediaItem;

    await expect(getAnilistIdForMedia(media)).resolves.toBeNull();
  });
});
