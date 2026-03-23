import { describe, expect, it } from "vitest";
import {
  matchesEpisodeSearch,
  parseEpisodeSearchQuery,
} from "@/lib/parse-episode-search-query";
import type { Episode } from "@/utils/typings";

const ep = (
  n: number,
  name: string,
  season = 2,
): { episode: Episode; seasonNumber: number } => ({
  episode: {
    id: n,
    name,
    overview: "",
    episode_number: n,
    air_date: "2020-01-01",
    still_path: null,
    runtime: null,
  },
  seasonNumber: season,
});

const match = (
  raw: string,
  row: { episode: Episode; seasonNumber: number },
): boolean => {
  const parsed = parseEpisodeSearchQuery(raw);
  const titleLower = (row.episode.name || "").toLowerCase();
  return matchesEpisodeSearch(
    row.episode,
    row.seasonNumber,
    titleLower,
    parsed,
    raw.trim(),
  );
};

describe("parseEpisodeSearchQuery", () => {
  it("parses episode 4 season 2", () => {
    expect(parseEpisodeSearchQuery("episode 4 season 2")).toEqual({
      season: 2,
      episode: 4,
      keywords: [],
    });
  });

  it("parses season 2 episode 4", () => {
    expect(parseEpisodeSearchQuery("season 2 episode 4")).toEqual({
      season: 2,
      episode: 4,
      keywords: [],
    });
  });

  it("parses s2e4", () => {
    expect(parseEpisodeSearchQuery("s2e4")).toEqual({
      season: 2,
      episode: 4,
      keywords: [],
    });
  });

  it("parses s2 e5 with spaces", () => {
    expect(parseEpisodeSearchQuery("s2 e5")).toEqual({
      season: 2,
      episode: 5,
      keywords: [],
    });
  });

  it("parses s02e05 with leading zeros", () => {
    expect(parseEpisodeSearchQuery("s02e05")).toEqual({
      season: 2,
      episode: 5,
      keywords: [],
    });
  });

  it("parses 2x4", () => {
    expect(parseEpisodeSearchQuery("2x4")).toEqual({
      season: 2,
      episode: 4,
      keywords: [],
    });
  });

  it("keeps extra title keywords", () => {
    expect(parseEpisodeSearchQuery("season 2 episode 4 pilot")).toEqual({
      season: 2,
      episode: 4,
      keywords: ["pilot"],
    });
  });
});

describe("matchesEpisodeSearch", () => {
  it("matches s2e4 only for that slot", () => {
    const target = ep(4, "The Pilot", 2);
    const otherSeason = ep(4, "Same number", 3);
    const otherEp = ep(5, "Other", 2);
    expect(match("episode 4 season 2", target)).toBe(true);
    expect(match("episode 4 season 2", otherSeason)).toBe(false);
    expect(match("episode 4 season 2", otherEp)).toBe(false);
  });

  it("matches season 2 episode 4 pilot when title contains pilot", () => {
    const row = ep(4, "Pilot", 2);
    expect(match("season 2 episode 4 pilot", row)).toBe(true);
    const noPilot = ep(4, "Other", 2);
    expect(match("season 2 episode 4 pilot", noPilot)).toBe(false);
  });

  it("matches loose title words", () => {
    const row = ep(1, "The Heist Begins", 1);
    expect(match("heist begins", row)).toBe(true);
  });

  it("matches single digit episode number", () => {
    const row = ep(4, "Name", 1);
    expect(match("4", row)).toBe(true);
  });
});
