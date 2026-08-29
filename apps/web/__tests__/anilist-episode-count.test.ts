import { describe, expect, it } from "vitest";

import { collectEpisodeNumbers } from "@/lib/anilist-tv-detail";
import type { AniListTvMedia } from "@/lib/anilist-tv-detail";

const baseMedia = (): AniListTvMedia => ({
  id: 186827,
  type: "ANIME",
  title: { romaji: "Fuuki Iin to Fuuzoku Katsudou" },
  status: "RELEASING",
  format: "OVA",
  episodes: null,
});

describe("collectEpisodeNumbers", () => {
  it("uses aired schedule entries when AniList episode count is unknown", () => {
    const media = {
      ...baseMedia(),
      airingSchedule: {
        nodes: [
          { episode: 1, airingAt: 1745506800 },
          { episode: 2, airingAt: 1745506800 },
        ],
      },
      nextAiringEpisode: null,
    };

    expect(collectEpisodeNumbers(media)).toEqual([1, 2]);
  });

  it("does not pad missing schedules to 12 placeholder episodes", () => {
    expect(
      collectEpisodeNumbers({
        ...baseMedia(),
        format: "TV",
        airingSchedule: { nodes: [] },
        nextAiringEpisode: null,
      }),
    ).toEqual([]);
  });
});
