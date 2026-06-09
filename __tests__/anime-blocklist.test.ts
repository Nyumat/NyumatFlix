import {
  ANIME_BLOCKLIST_IDS,
  filterAnimeBlocked,
  isAnimeBlocked,
} from "@/lib/anime-blocklist";
import type { MediaItem } from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

describe("anime blocklist", () => {
  it("blocks configured ids by tmdb or anilist id", () => {
    expect(isAnimeBlocked({ id: 95897 } as MediaItem)).toBe(true);
    expect(
      isAnimeBlocked({
        id: 42,
        sourceAnilistId: 95897,
      } as unknown as MediaItem),
    ).toBe(true);
    expect(isAnimeBlocked({ id: 42 } as MediaItem)).toBe(false);
  });

  it("exports the one-off block array", () => {
    expect(ANIME_BLOCKLIST_IDS).toContain(95897);
  });

  it("filters blocked items from lists", () => {
    const items = filterAnimeBlocked([
      { id: 95897 } as MediaItem,
      { id: 1 } as MediaItem,
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(1);
  });
});
