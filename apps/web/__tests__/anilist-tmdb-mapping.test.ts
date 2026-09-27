import { getDisplayTitle } from "@/lib/cards/selectors";
import { mapAniListMediaToMediaItem } from "@/lib/anilist-shared";
import { findAnilistIdByTmdbId } from "@/lib/fribb-mapping";
import { describe, expect, it } from "vitest";

describe("anime mapping title preservation", () => {
  it("keeps AniList titles on mapped media items", () => {
    const fallback = mapAniListMediaToMediaItem({
      id: 21,
      title: {
        english: "One Piece",
        romaji: "ONE PIECE",
        native: "ワンピース",
      },
      type: "ANIME",
      format: "TV",
    });

    const mapped = {
      ...fallback,
      id: 111110,
      media_type: "tv" as const,
      isAniListFallback: false,
      sourceAnilistId: 21,
      name: "One Piece",
      title: "One Piece",
    };

    expect(getDisplayTitle(mapped)).toBe("One Piece");
  });

  it("uses english title before romaji for display", () => {
    const item = mapAniListMediaToMediaItem({
      id: 154587,
      title: {
        english: "Frieren: Beyond Journey's End",
        romaji: "Sousou no Frieren",
        native: "葬送のフリーレン",
      },
      type: "ANIME",
      format: "TV",
    });

    expect(getDisplayTitle(item)).toBe("Frieren: Beyond Journey's End");
  });
});

describe("TMDB to AniList mapping", () => {
  it("resolves the first season of a TMDB TV series", () => {
    expect(
      findAnilistIdByTmdbId(
        {
          21: { tv: 37854 },
          99999: { tv: 37854, season: 2 },
        },
        37854,
        "tv",
      ),
    ).toBe(21);
  });
});

describe("AniList trailer mapping", () => {
  it("keeps a YouTube trailer key on the media item", () => {
    const item = mapAniListMediaToMediaItem({
      id: 113415,
      title: { english: "Jujutsu Kaisen", romaji: "Jujutsu Kaisen" },
      type: "ANIME",
      format: "TV",
      trailer: { id: "RIyb52EMx8c", site: "youtube" },
    });

    expect((item as { youtube_trailer_key?: string }).youtube_trailer_key).toBe(
      "RIyb52EMx8c",
    );
  });

  it("ignores non-YouTube trailers", () => {
    const item = mapAniListMediaToMediaItem({
      id: 1,
      title: { romaji: "Some Anime" },
      type: "ANIME",
      format: "TV",
      trailer: { id: "x123", site: "dailymotion" },
    });

    expect(
      (item as { youtube_trailer_key?: string }).youtube_trailer_key,
    ).toBeUndefined();
  });
});
