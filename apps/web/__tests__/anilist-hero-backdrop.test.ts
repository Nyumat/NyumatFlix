import {
  pickFirstEpisodeStillFromDetails,
  youtubeMaxresFromAnilistMedia,
  youtubeTrailerMaxresUrl,
} from "@/lib/anilist-hero-backdrop";
import type { AniListTvMedia } from "@/lib/anilist-tv-detail";
import type { TvShowDetails } from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

const trailerMedia = {
  trailer: { id: "aOOwNK6Ul6E", site: "youtube" },
} as AniListTvMedia;

describe("youtubeTrailerMaxresUrl", () => {
  it("builds a YouTube maxres thumbnail URL", () => {
    expect(youtubeTrailerMaxresUrl("aOOwNK6Ul6E")).toBe(
      "https://i.ytimg.com/vi/aOOwNK6Ul6E/maxresdefault.jpg",
    );
  });
});

describe("youtubeMaxresFromAnilistMedia", () => {
  it("reads trailer data from AniList media", () => {
    expect(youtubeMaxresFromAnilistMedia(trailerMedia)).toBe(
      "https://i.ytimg.com/vi/aOOwNK6Ul6E/maxresdefault.jpg",
    );
  });
});

describe("pickFirstEpisodeStillFromDetails", () => {
  it("returns the first season episode still when available", () => {
    const details = {
      poster_path: "/poster.jpg",
      seasons: [
        {
          season_number: 1,
          episodes: [
            {
              episode_number: 1,
              still_path: "/episode-1.jpg",
            },
          ],
        },
      ],
    } as TvShowDetails;

    expect(pickFirstEpisodeStillFromDetails(details)).toBe("/episode-1.jpg");
  });

  it("ignores stills that duplicate the poster", () => {
    const details = {
      poster_path: "/poster.jpg",
      seasons: [
        {
          season_number: 1,
          episodes: [
            {
              episode_number: 1,
              still_path: "/poster.jpg",
            },
          ],
        },
      ],
    } as TvShowDetails;

    expect(pickFirstEpisodeStillFromDetails(details)).toBeNull();
  });
});
