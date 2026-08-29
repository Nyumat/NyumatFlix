import { describe, expect, it } from "vitest";

import type { Episode } from "@/lib/domain/typings";
import { episodeNumberForProviders } from "@/lib/tv-provider-episode";

const stubEpisode = (episode_number: number, id: number): Episode => ({
  id,
  episode_number,
  name: `Episode ${episode_number}`,
  overview: "",
  air_date: "",
  still_path: null,
  runtime: null,
});

describe("episodeNumberForProviders", () => {
  it("maps One Piece season 11 absolute numbers to provider-relative slots", () => {
    const season11 = [382, 383, 384, 385].map((episode_number, index) =>
      stubEpisode(episode_number, index + 1),
    );

    expect(episodeNumberForProviders(season11, 384)).toBe(3);
    expect(episodeNumberForProviders(season11, 382)).toBe(1);
  });

  it("keeps standard 1-based seasons unchanged", () => {
    const season1 = [1, 2, 3, 4].map((episode_number, index) =>
      stubEpisode(episode_number, index + 1),
    );

    expect(episodeNumberForProviders(season1, 3)).toBe(3);
  });
});
