import {
  appendKnownSpecialSequelIds,
  extendMappingSegmentsWithKnownSpecialSequels,
  resolveKnownSpecialSequelAppendixIds,
} from "@/lib/anime/special-sequel-appendix";
import { describe, expect, it } from "vitest";

describe("special sequel appendix", () => {
  it("resolves Attack on Titan Final Chapters special 2 from special 1", () => {
    expect(resolveKnownSpecialSequelAppendixIds(146984)).toEqual([162314]);
  });

  it("appends known sequel ids after the Fribb tail", () => {
    expect(appendKnownSpecialSequelIds([110277, 131681, 146984])).toEqual([
      110277, 131681, 146984, 162314,
    ]);
  });

  it("extends map segments with the chained finale special", () => {
    expect(
      extendMappingSegmentsWithKnownSpecialSequels([
        { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
        { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
        { startEpisode: 29, endEpisode: 29, anilistMediaId: 146984 },
      ]),
    ).toEqual([
      { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
      { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
      { startEpisode: 29, endEpisode: 29, anilistMediaId: 146984 },
      { startEpisode: 30, endEpisode: 30, anilistMediaId: 162314 },
    ]);
  });
});
