import { describe, expect, it } from "vitest";

import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import {
  mergeSearchMediaResults,
  rankSearchMediaResults,
} from "@/lib/search/merge-search-media";

const tmdbCard = (
  id: number,
  overrides: Partial<CanonicalMediaCard> = {},
): CanonicalMediaCard =>
  ({
    id,
    media_type: "tv",
    title: `TMDB ${id}`,
    name: `TMDB ${id}`,
    href: `/tvshows/${id}`,
    popularity: 10,
    ...overrides,
  }) as CanonicalMediaCard;

const anilistMediaItem = (
  id: number,
  overrides: Partial<MediaItem> & { title?: string; href?: string } = {},
): MediaItem =>
  ({
    id: overrides.id ?? 900000 + id,
    media_type: "tv",
    name: overrides.title ?? `Anime ${id}`,
    original_name: overrides.title ?? `Anime ${id}`,
    original_language: "ja",
    overview: "",
    popularity: 50,
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    sourceAnilistId: id,
    isAniListFallback: true,
    href: overrides.href ?? buildAnilistTvDetailHref(id),
    ...overrides,
  }) as MediaItem;

describe("mergeSearchMediaResults", () => {
  it("includes AniList-only titles when TMDB has no match", () => {
    const merged = mergeSearchMediaResults(
      [],
      [
        anilistMediaItem(21222, {
          name: "Mankitsu Happening",
          title: "Mankitsu Happening",
          popularity: 42,
        }),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.href).toBe("/anime/anilist-21222");
    expect(merged[0]?.title).toBe("Mankitsu Happening");
  });

  it("dedupes AniList rows already represented by TMDB id", () => {
    const merged = mergeSearchMediaResults(
      [tmdbCard(12345, { popularity: 100 })],
      [
        anilistMediaItem(21222, {
          id: 12345,
          name: "Mapped Anime",
          title: "Mapped Anime",
          href: "/tvshows/12345",
          popularity: 80,
        }),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(12345);
  });

  it("keeps AniList-only href when TMDB id collides but href is anilist route", () => {
    const merged = mergeSearchMediaResults(
      [tmdbCard(12345)],
      [
        anilistMediaItem(21222, {
          id: 12345,
          href: "/anime/anilist-21222",
        }),
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.some((card) => card.href === "/anime/anilist-21222")).toBe(
      true,
    );
  });

  it("ranks mainstream TMDB matches above adult anime for ambiguous titles", () => {
    const ranked = rankSearchMediaResults(
      [
        tmdbCard(74805, {
          title: "euphoria",
          popularity: 0,
          vote_average: 5.3,
          vote_count: 10,
          href: "/tvshows/anilist-10851",
          sourceAnilistId: 10851,
        } as Partial<CanonicalMediaCard>),
        tmdbCard(85552, {
          title: "Euphoria",
          popularity: 81,
          vote_average: 8.3,
          vote_count: 11000,
        }),
      ],
      "euphoria",
    );

    expect(ranked[0]?.id).toBe(85552);
    expect(ranked[1]?.id).toBe(74805);
  });

  it("dedupes duplicate AniList ids", () => {
    const merged = mergeSearchMediaResults(
      [],
      [
        anilistMediaItem(21222, { name: "First", title: "First" }),
        anilistMediaItem(21222, { name: "Duplicate", title: "Duplicate" }),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe("First");
  });
});
