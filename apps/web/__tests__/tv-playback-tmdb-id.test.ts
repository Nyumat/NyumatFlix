import { describe, expect, it } from "vitest";

import type { MediaItem } from "@/lib/domain/typings";
import {
  excludeDirectScrapeProvider,
  isDirectPlaybackEligible,
  readMappedTmdbTvIdFromMedia,
  resolveTvPlaybackTmdbId,
} from "@/lib/tv-playback-tmdb-id";

const mediaWithMapping = {
  id: 113417,
  mappedTmdbTvId: 104602,
  name: "Overflow",
} as unknown as MediaItem;

describe("tv playback tmdb id", () => {
  it("reads mapped TMDB id from AniList detail payloads", () => {
    expect(readMappedTmdbTvIdFromMedia(mediaWithMapping)).toBe(104602);
    expect(
      readMappedTmdbTvIdFromMedia({
        id: 113417,
        name: "Overflow",
      } as unknown as MediaItem),
    ).toBeNull();
  });

  it("resolves TMDB id for bare anime catalog routes from mapped metadata", () => {
    expect(resolveTvPlaybackTmdbId("154587", mediaWithMapping, "anime")).toBe(
      104602,
    );
  });

  it("does not treat bare numeric ids as TMDB when catalog is missing", () => {
    expect(resolveTvPlaybackTmdbId("154587", mediaWithMapping)).toBe(154587);
  });

  it("resolves TMDB id for AniList routes from mapped metadata", () => {
    expect(resolveTvPlaybackTmdbId("anilist-113417", mediaWithMapping)).toBe(
      104602,
    );
    expect(
      resolveTvPlaybackTmdbId("anilist-113417", {
        id: 113417,
        name: "Overflow",
      } as MediaItem),
    ).toBeNull();
  });

  it("resolves numeric TMDB routes directly", () => {
    expect(
      resolveTvPlaybackTmdbId("85937", {
        id: 85937,
        name: "Show",
      } as MediaItem),
    ).toBe(85937);
  });

  it("gates direct playback for adult AniList routes", () => {
    expect(
      isDirectPlaybackEligible({
        directScrapeProviderAvailable: true,
        mediaType: "tv",
        mediaId: 113417,
        isAdultAnime: true,
        resolvedTmdbTvId: 104602,
      }),
    ).toBe(false);

    expect(
      isDirectPlaybackEligible({
        directScrapeProviderAvailable: true,
        mediaType: "tv",
        mediaId: 113417,
        isAdultAnime: false,
        resolvedTmdbTvId: 104602,
      }),
    ).toBe(true);

    expect(
      isDirectPlaybackEligible({
        directScrapeProviderAvailable: true,
        mediaType: "tv",
        mediaId: 113417,
        isAdultAnime: false,
        resolvedTmdbTvId: null,
      }),
    ).toBe(false);
  });

  it("removes direct from scrape menus when unavailable", () => {
    const options = [
      { providerId: "hentaini", name: "Hentaini" },
      { providerId: "direct", name: "Direct" },
    ];

    expect(
      excludeDirectScrapeProvider(options, false).map((o) => o.providerId),
    ).toEqual(["hentaini"]);
    expect(
      excludeDirectScrapeProvider(options, true).map((o) => o.providerId),
    ).toEqual(["hentaini", "direct"]);
  });
});
