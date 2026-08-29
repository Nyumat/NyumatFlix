import { describe, expect, test } from "vitest";

import type { AniListTvMedia } from "@/lib/anilist-tv-detail";
import {
  anilistTitleMatchesTmdbName,
  shouldPreferAnilistWatchlistMedia,
} from "@/lib/watchlist/anilist-watchlist-id";

const smokingBehindAnilist = {
  id: 196187,
  type: "ANIME" as const,
  title: {
    english: "Smoking Behind the Supermarket with You",
    romaji: "Supermarket no Oni Joushi",
    native: "スーパーの裏で吸うのやめてもらえますか",
  },
  startDate: { year: 2026 },
} satisfies AniListTvMedia;

describe("anilistTitleMatchesTmdbName", () => {
  test("matches equivalent titles", () => {
    expect(
      anilistTitleMatchesTmdbName(
        smokingBehindAnilist,
        "Smoking Behind the Supermarket with You",
      ),
    ).toBe(true);
  });

  test("rejects unrelated TMDB titles", () => {
    expect(
      anilistTitleMatchesTmdbName(
        smokingBehindAnilist,
        "The Channel Islands At War",
      ),
    ).toBe(false);
  });
});

describe("shouldPreferAnilistWatchlistMedia", () => {
  test("prefers AniList when TMDB id collision returns a different show", () => {
    expect(
      shouldPreferAnilistWatchlistMedia({
        anilistMedia: smokingBehindAnilist,
        tmdbTitle: "The Channel Islands At War",
        tmdbFetchSucceeded: true,
        mappedTmdbId: 284644,
        contentId: 196187,
      }),
    ).toBe(true);
  });

  test("keeps TMDB when titles agree and ids align", () => {
    expect(
      shouldPreferAnilistWatchlistMedia({
        anilistMedia: smokingBehindAnilist,
        tmdbTitle: "Smoking Behind the Supermarket with You",
        tmdbFetchSucceeded: true,
        mappedTmdbId: 196187,
        contentId: 196187,
      }),
    ).toBe(false);
  });

  test("prefers AniList when TMDB lookup fails", () => {
    expect(
      shouldPreferAnilistWatchlistMedia({
        anilistMedia: smokingBehindAnilist,
        tmdbTitle: null,
        tmdbFetchSucceeded: false,
        mappedTmdbId: null,
        contentId: 196187,
      }),
    ).toBe(true);
  });
});
