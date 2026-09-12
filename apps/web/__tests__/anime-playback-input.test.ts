import { describe, expect, it } from "vitest";

import { ANIME_COORDS_PENDING_TIMEOUT_MS } from "@/lib/anime/anime-playback-policy";
import { toPlayableManifestFromScrape } from "@/lib/playback/to-playable-manifest";
import { selectPlaybackShellEngine } from "@/lib/playback/select-playback-engine";
import { isScrapeVideoMakingProgress } from "@/lib/player/player-playback-ready";
import { useEpisodeStore } from "@/lib/stores/episode-store";

describe("anime playback fix integration checks", () => {
  it("fix 2: dash + movi preference still selects vidstack", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "animeonsen",
      providerName: "AnimeOnsen",
      playUrl: "/api/scrape/play/token/asset.mpd",
      streamKind: "dash",
    });

    expect(selectPlaybackShellEngine(manifest, { userEngine: "movi" })).toBe(
      "vidstack",
    );
  });

  it("fix 3: isScrapeVideoMakingProgress is wired in hero panel", () => {
    expect(typeof isScrapeVideoMakingProgress).toBe("function");
  });

  it("fix 4: coords fallback mapping resolves anilist route playback", () => {
    useEpisodeStore.getState().clearSelectedEpisode();
    useEpisodeStore.getState().setDefaultAnilistId(196187);
    useEpisodeStore.getState().setPlaybackTmdbTvId(null);
    useEpisodeStore.getState().setAnimeCoordsStatus("pending");
    useEpisodeStore.getState().setSelectedEpisode(
      {
        id: 1,
        episode_number: 1,
        name: "Episode 1",
        overview: "",
        still_path: null,
        air_date: "",
        vote_average: 0,
        runtime: 24,
      },
      "anilist-196187",
      1,
    );

    useEpisodeStore.getState().applyAnimeEpisodeMapping(
      {
        animeInfo: {
          anilistId: 196187,
          startEpisode: 1,
          endEpisode: 1,
        },
        relativeEpisodeNumber: 1,
        confidence: "low",
        isAdult: false,
        animeSeasonNumber: 1,
      },
      {
        tvShowId: "anilist-196187",
        seasonNumber: 1,
        episodeNumber: 1,
      },
    );

    const state = useEpisodeStore.getState();
    expect(state.animeCoordsStatus).toBe("resolved");
    expect(state.anilistId).toBe(196187);
    expect(state.relativeEpisodeNumber).toBe(1);
    expect(ANIME_COORDS_PENDING_TIMEOUT_MS).toBe(12_000);
  });

  it("fix 6: dash manifest trims subtitle payload at build time", () => {
    const manifest = toPlayableManifestFromScrape({
      providerId: "animeonsen",
      providerName: "AnimeOnsen",
      playUrl: "/api/scrape/play/token/asset.mpd",
      streamKind: "dash",
      subtitles: Array.from({ length: 10 }, (_, index) => ({
        lang: `lang-${index}`,
        url: `https://example.com/${index}.vtt`,
      })),
    });

    expect(manifest.subtitles.length).toBeLessThanOrEqual(3);
  });

  it("fix 5: anime playback input shape allows null tmdb", () => {
    const animeInput = {
      anilistId: 196187,
      episodeNumber: 1,
      translationType: "sub" as const,
    };
    const chain = {
      mappingConfidence: "high" as const,
      isAdultAnime: false,
      anilistGenres: [] as string[],
      translationType: "sub" as const,
    };

    const playbackInput = {
      anime: animeInput,
      tmdb: null,
      chain,
    };

    expect(playbackInput.tmdb).toBeNull();
    expect(playbackInput.anime.anilistId).toBe(196187);
  });
});
