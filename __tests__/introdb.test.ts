import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildIntroDbChaptersVtt,
  buildIntroDbChapterGradient,
  buildIntroDbMediaUrl,
  fetchIntroDbSegments,
  findActiveIntroDbSegment,
  isIntroDbLookupReady,
  isTerminalIntroDbCredit,
  mergeIntroDbSegments,
  parseIntroDbAppSegments,
  parseIntroDbSegments,
  readIntroDbImdbId,
} from "@/lib/playback/introdb";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";

const movieKey: PlaybackProgressKey = {
  mediaType: "movie",
  contentId: 1_084_242,
};

const episodeKey: PlaybackProgressKey = {
  mediaType: "tv",
  contentId: 12_345,
  seasonNumber: 1,
  episodeNumber: 2,
};

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("IntroDB playback helpers", () => {
  it("builds canonical movie and episode lookups with release duration", () => {
    expect(buildIntroDbMediaUrl(movieKey, 6371.111)).toBe(
      "https://api.theintrodb.org/v3/media?tmdb_id=1084242&duration_ms=6371111",
    );
    expect(buildIntroDbMediaUrl(episodeKey, 2760)).toBe(
      "https://api.theintrodb.org/v3/media?tmdb_id=12345&duration_ms=2760000&season=1&episode=2",
    );
  });

  it("requires canonical season and episode numbers for TV", () => {
    expect(isIntroDbLookupReady({ mediaType: "tv", contentId: 12_345 })).toBe(
      false,
    );
    expect(isIntroDbLookupReady(episodeKey)).toBe(true);
  });

  it("normalizes every supported segment type and multiple credits", () => {
    const segments = parseIntroDbSegments(
      {
        tmdb_id: 12_345,
        type: "tv",
        season: 1,
        episode: 2,
        recap: [{ start_ms: null, end_ms: 25_000 }],
        intro: [{ start_ms: 30_000, end_ms: 90_000 }],
        preview: [{ start_ms: 1_680_000, end_ms: 1_740_000 }],
        credits: [
          { start_ms: 2_580_000, end_ms: 2_620_000 },
          { start_ms: 2_700_000, end_ms: null },
        ],
      },
      episodeKey,
      2760,
    );

    expect(segments?.map((segment) => segment.type)).toEqual([
      "recap",
      "intro",
      "preview",
      "credits",
      "credits",
    ]);
    expect(segments?.[0]).toMatchObject({
      startSeconds: 0,
      endSeconds: 25,
    });
    expect(segments?.at(-1)).toMatchObject({
      endSeconds: 2760,
      endsAtMediaEnd: true,
    });
  });

  it("fails closed on mismatched identity or malformed type-specific times", () => {
    expect(
      parseIntroDbSegments(
        {
          tmdb_id: 999,
          type: "movie",
          intro: [{ start_ms: null, end_ms: 23_000 }],
        },
        movieKey,
        100,
      ),
    ).toBeNull();

    expect(
      parseIntroDbSegments(
        {
          tmdb_id: movieKey.contentId,
          type: "movie",
          intro: [{ start_ms: 50_000, end_ms: null }],
          credits: [{ start_ms: null, end_ms: 90_000 }],
        },
        movieKey,
        100,
      ),
    ).toEqual([]);
  });

  it("drops zero-length and out-of-release segments", () => {
    expect(
      parseIntroDbSegments(
        {
          tmdb_id: movieKey.contentId,
          type: "movie",
          intro: [
            { start_ms: 0, end_ms: 0 },
            { start_ms: 90_000, end_ms: 110_000 },
          ],
        },
        movieKey,
        100,
      ),
    ).toEqual([]);
  });

  it("finds active segments with an exclusive end boundary", () => {
    const segments = parseIntroDbSegments(
      {
        tmdb_id: movieKey.contentId,
        type: "movie",
        intro: [{ start_ms: 30_000, end_ms: 90_000 }],
      },
      movieKey,
      100,
    );

    expect(findActiveIntroDbSegment(segments ?? [], 29.999)).toBeNull();
    expect(findActiveIntroDbSegment(segments ?? [], 30)?.type).toBe("intro");
    expect(findActiveIntroDbSegment(segments ?? [], 90)).toBeNull();
  });

  it("only treats the final end-of-media credit range as terminal", () => {
    const segments = parseIntroDbSegments(
      {
        tmdb_id: movieKey.contentId,
        type: "movie",
        credits: [
          { start_ms: 80_000, end_ms: 90_000 },
          { start_ms: 95_000, end_ms: null },
        ],
      },
      movieKey,
      100,
    );

    expect(isTerminalIntroDbCredit(segments?.[0]!, segments ?? [])).toBe(false);
    expect(isTerminalIntroDbCredit(segments?.[1]!, segments ?? [])).toBe(true);
  });

  it("creates a Vidstack-compatible chapters track", () => {
    const segments = parseIntroDbSegments(
      {
        tmdb_id: movieKey.contentId,
        type: "movie",
        intro: [{ start_ms: 30_000, end_ms: 90_000 }],
        credits: [{ start_ms: 580_000, end_ms: null }],
      },
      movieKey,
      600,
    );

    expect(buildIntroDbChaptersVtt(segments ?? [])).toBe(
      "WEBVTT\n\n1\n00:00:30.000 --> 00:01:30.000\nIntro\n\n2\n00:09:40.000 --> 00:10:00.000\nCredits\n",
    );
  });

  it("builds exact per-type colors for the Vidstack chapter bar", () => {
    const segments = parseIntroDbSegments(
      {
        tmdb_id: movieKey.contentId,
        type: "movie",
        recap: [{ start_ms: 0, end_ms: 10_000 }],
        intro: [{ start_ms: 20_000, end_ms: 30_000 }],
        credits: [{ start_ms: 80_000, end_ms: null }],
      },
      movieKey,
      100,
    );

    expect(buildIntroDbChapterGradient(segments ?? [], 100)).toBe(
      "linear-gradient(to right, transparent 0%, transparent 0%, rgb(245 158 11 / 0.92) 0%, rgb(245 158 11 / 0.92) 10%, transparent 10%, transparent 20%, rgb(217 70 239 / 0.92) 20%, rgb(217 70 239 / 0.92) 30%, transparent 30%, transparent 80%, rgb(99 102 241 / 0.92) 80%, rgb(99 102 241 / 0.92) 100%, transparent 100%, transparent 100%)",
    );
  });

  it("parses IntroDB.app episode segments and maps outro to credits", () => {
    const segments = parseIntroDbAppSegments(
      {
        imdb_id: "tt0903747",
        season: 1,
        episode: 1,
        intro: { start_ms: 2_000, end_ms: 58_000, confidence: 1 },
        recap: null,
        outro: { start_ms: 3_431_000, end_ms: 3_500_000 },
      },
      {
        imdbId: "tt0903747",
        seasonNumber: 1,
        episodeNumber: 1,
      },
      3500,
    );

    expect(segments?.map((segment) => segment.type)).toEqual([
      "intro",
      "credits",
    ]);
    expect(segments?.at(-1)?.endsAtMediaEnd).toBe(true);
  });

  it("keeps TheIntroDB authoritative and only fills missing types", () => {
    const primary = parseIntroDbSegments(
      {
        tmdb_id: episodeKey.contentId,
        type: "tv",
        season: 1,
        episode: 2,
        intro: [{ start_ms: 30_000, end_ms: 90_000 }],
      },
      episodeKey,
      600,
    );
    const fallback = parseIntroDbAppSegments(
      {
        imdb_id: "tt0903747",
        season: 1,
        episode: 2,
        intro: { start_ms: 20_000, end_ms: 80_000 },
        recap: { start_ms: 0, end_ms: 20_000 },
        outro: null,
      },
      {
        imdbId: "tt0903747",
        seasonNumber: 1,
        episodeNumber: 2,
      },
      600,
    );

    const merged = mergeIntroDbSegments(primary ?? [], fallback ?? []);
    expect(merged.map((segment) => segment.type)).toEqual(["recap", "intro"]);
    expect(merged.find(({ type }) => type === "intro")?.startSeconds).toBe(30);
  });

  it("reads only exact IMDb IDs from media details", () => {
    expect(readIntroDbImdbId({ external_ids: { imdb_id: "tt0903747" } })).toBe(
      "tt0903747",
    );
    expect(readIntroDbImdbId({ imdb_id: "tt0944947" })).toBe("tt0944947");
    expect(readIntroDbImdbId({ imdb_id: "tt-not-valid" })).toBeNull();
  });

  it("uses IntroDB.app when the primary provider is unavailable", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("primary unavailable"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            imdb_id: "tt0903747",
            season: 1,
            episode: 2,
            intro: { start_ms: 2_000, end_ms: 58_000 },
            recap: null,
            outro: null,
          }),
          { status: 200 },
        ),
      );

    const segments = await fetchIntroDbSegments(episodeKey, 600, "tt0903747");

    expect(segments.map((segment) => segment.type)).toEqual(["intro"]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(global.fetch).mock.calls[1]?.[0]).toBe(
      "/api/introdb/segments?imdb_id=tt0903747&season=1&episode=2",
    );
  });
});
