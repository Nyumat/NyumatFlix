import type { AniListTvMedia } from "@/lib/anilist-tv-detail";
import {
  pickBestTmdbTvCandidate,
  scoreTmdbTvCandidate,
} from "@/lib/anilist-tmdb-match";
import { selectExactTmdbTvRouteCandidate as selectRouteCandidate } from "@/lib/anilist-tmdb-route";
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

const yanmamaMedia: AniListTvMedia = {
  id: 115138,
  type: "ANIME",
  format: "OVA",
  title: {
    english: null,
    romaji: "Ane wa Yanmama Junyuu-chuu",
    native: "義姉はヤンママ授乳中",
  },
  startDate: { year: 2020, month: 6, day: 5 },
};

const yanmamaCandidates = [
  {
    id: 104602,
    media_type: "tv" as const,
    name: "Ane wa Yanmama Junyuu-chuu",
    original_name: "義姉はヤンママ授乳中",
    first_air_date: "2020-06-04",
    genre_ids: [16],
    vote_average: 8.2,
  },
  {
    id: 325150,
    media_type: "tv" as const,
    name: "義姉はヤンママ授乳中",
    original_name: "義姉はヤンママ授乳中",
    first_air_date: "2020-06-17",
    genre_ids: [16],
    vote_average: 0,
  },
];

const succubusMedia: AniListTvMedia = {
  id: 153346,
  type: "ANIME",
  format: "OVA",
  title: {
    english: null,
    romaji: "Succubus Yondara Haha ga Kita!?",
    native: "サキュバス喚んだら義母が来た!?",
  },
  startDate: { year: 2022, month: 11, day: 4 },
};

const succubusCandidates = [
  {
    id: 208639,
    media_type: "tv" as const,
    name: "Succubus Yondara Gibo ga Kita!?",
    original_name: "サキュバス喚んだら義母が来た!?",
    first_air_date: "2022-11-03",
    genre_ids: [16],
    vote_average: 7.4,
  },
  {
    id: 325117,
    media_type: "tv" as const,
    name: "サキュバス喚んだら義母が来た!?",
    original_name: "サキュバス喚んだら義母が来た!?",
    first_air_date: "2022-11-22",
    genre_ids: [16],
    vote_average: 0,
  },
];

describe("selectExactTmdbTvRouteCandidate", () => {
  it("maps AniList 196218 despite its one-week TMDB premiere-date drift", () => {
    expect(
      selectRouteCandidate(frontierLordMedia, [frontierLordCandidate]),
    ).toEqual(frontierLordCandidate);
  });

  it("accepts one exact title, animation, and premiere-date match", () => {
    expect(selectRouteCandidate(media, [exactCandidate])).toEqual(
      exactCandidate,
    );
  });

  it("accepts a small premiere-date drift when two title fields match", () => {
    expect(
      selectRouteCandidate(media, [
        { ...exactCandidate, first_air_date: "2021-04-02" },
      ]),
    ).toEqual({ ...exactCandidate, first_air_date: "2021-04-02" });
  });

  it("rejects a premiere-date drift when only one title field matches", () => {
    expect(
      selectRouteCandidate(media, [
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
      selectRouteCandidate(media, [
        { ...exactCandidate, first_air_date: "2021-04-10" },
      ]),
    ).toBeNull();
  });

  it("rejects title-only matches with a different premiere date", () => {
    expect(
      selectRouteCandidate(media, [
        { ...exactCandidate, first_air_date: "2022-03-26" },
      ]),
    ).toBeNull();
  });

  it("rejects non-animation matches", () => {
    expect(
      selectRouteCandidate(media, [{ ...exactCandidate, genre_ids: [18] }]),
    ).toBeNull();
  });

  it("picks the best duplicate TMDB id for yanmama", () => {
    expect(selectRouteCandidate(yanmamaMedia, yanmamaCandidates)?.id).toBe(
      104602,
    );
  });
});

describe("pickBestTmdbTvCandidate", () => {
  it("maps succubus haha/gibo naming to TMDB gibo entry", () => {
    expect(pickBestTmdbTvCandidate(succubusMedia, succubusCandidates)?.id).toBe(
      208639,
    );
  });

  it("scores gibo titles higher than duplicate native-only TMDB rows", () => {
    const giboScore = scoreTmdbTvCandidate(
      succubusMedia,
      succubusCandidates[0]!,
    );
    const nativeScore = scoreTmdbTvCandidate(
      succubusMedia,
      succubusCandidates[1]!,
    );
    expect(giboScore).toBeGreaterThan(nativeScore);
  });
});
