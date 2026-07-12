import { selectExactTmdbTvRouteCandidate } from "@/lib/anilist-tmdb-route";
import type { AniListTvMedia } from "@/lib/anilist-tv-detail";
import { describe, expect, it } from "vitest";

const media: AniListTvMedia = {
  id: 128516,
  type: "ANIME",
  format: "ONA",
  title: {
    english: null,
    romaji: "Tooi Kimi ni, Boku wa Todokanai",
    native: "遠い君に、僕は届かない",
  },
  startDate: { year: 2021, month: 3, day: 26 },
};

const exactCandidate = {
  id: 122281,
  media_type: "tv" as const,
  name: "Tooi Kimi ni, Boku wa Todokanai",
  original_name: "遠い君に、僕は届かない",
  first_air_date: "2021-03-26",
  genre_ids: [16],
};

const frontierLordMedia: AniListTvMedia = {
  id: 196218,
  type: "ANIME",
  format: "ONA",
  title: {
    english: "The Frontier Lord Begins with Zero Subjects",
    romaji: "Ryoumin 0-Nin Start no Henkyou Ryoushu-sama",
    native: "領民0人スタートの辺境領主様",
  },
  startDate: { year: 2026, month: 7, day: 3 },
};

const frontierLordCandidate = {
  id: 296437,
  media_type: "tv" as const,
  name: "The Frontier Lord Begins with Zero Subjects",
  original_name: "領民0人スタートの辺境領主様",
  first_air_date: "2026-07-10",
  genre_ids: [16, 35, 10759, 10765],
};

describe("selectExactTmdbTvRouteCandidate", () => {
  it("maps AniList 196218 despite its one-week TMDB premiere-date drift", () => {
    expect(
      selectExactTmdbTvRouteCandidate(frontierLordMedia, [
        frontierLordCandidate,
      ]),
    ).toEqual(frontierLordCandidate);
  });

  it("accepts one exact title, animation, and premiere-date match", () => {
    expect(selectExactTmdbTvRouteCandidate(media, [exactCandidate])).toEqual(
      exactCandidate,
    );
  });

  it("accepts a small premiere-date drift when two title fields match", () => {
    expect(
      selectExactTmdbTvRouteCandidate(media, [
        { ...exactCandidate, first_air_date: "2021-04-02" },
      ]),
    ).toEqual({ ...exactCandidate, first_air_date: "2021-04-02" });
  });

  it("rejects a premiere-date drift when only one title field matches", () => {
    expect(
      selectExactTmdbTvRouteCandidate(media, [
        {
          ...exactCandidate,
          original_name: "Different original title",
          first_air_date: "2021-04-02",
        },
      ]),
    ).toBeNull();
  });

  it("rejects a premiere-date drift beyond two weeks", () => {
    expect(
      selectExactTmdbTvRouteCandidate(media, [
        { ...exactCandidate, first_air_date: "2021-04-10" },
      ]),
    ).toBeNull();
  });

  it("rejects title-only matches with a different premiere date", () => {
    expect(
      selectExactTmdbTvRouteCandidate(media, [
        { ...exactCandidate, first_air_date: "2022-03-26" },
      ]),
    ).toBeNull();
  });

  it("rejects non-animation matches", () => {
    expect(
      selectExactTmdbTvRouteCandidate(media, [
        { ...exactCandidate, genre_ids: [18] },
      ]),
    ).toBeNull();
  });

  it("fails closed when more than one TMDB id matches exactly", () => {
    expect(
      selectExactTmdbTvRouteCandidate(media, [
        exactCandidate,
        { ...exactCandidate, id: 999999 },
      ]),
    ).toBeNull();
  });
});
