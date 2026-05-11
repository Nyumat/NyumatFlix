import { describe, expect, it } from "vitest";

import {
  extractVideoRowsFromMediaVideos,
  selectPrimaryTrailerKey,
  selectPrimaryTrailerVideo,
} from "@/lib/select-primary-trailer-video";

describe("selectPrimaryTrailerVideo", () => {
  it("ignores featurettes and picks newest official trailer", () => {
    const rows = [
      {
        type: "Featurette",
        key: "feat1",
        site: "YouTube",
        official: true,
        published_at: "2026-04-10T19:00:19.000Z",
      },
      {
        type: "Trailer",
        key: "final",
        site: "YouTube",
        official: true,
        published_at: "2026-03-09T21:09:01.000Z",
      },
      {
        type: "Trailer",
        key: "yoshi",
        site: "YouTube",
        official: true,
        published_at: "2026-01-25T14:09:20.000Z",
      },
      {
        type: "Trailer",
        key: "official",
        site: "YouTube",
        official: true,
        published_at: "2025-11-12T14:10:02.000Z",
      },
    ];
    expect(selectPrimaryTrailerVideo(rows)?.key).toBe("final");
  });

  it("prefers official trailer over newer unofficial when both are trailers", () => {
    const rows = [
      {
        type: "Trailer",
        key: "unofficial",
        site: "YouTube",
        official: false,
        published_at: "2026-05-01T00:00:00.000Z",
      },
      {
        type: "Trailer",
        key: "official",
        site: "YouTube",
        official: true,
        published_at: "2025-01-01T00:00:00.000Z",
      },
    ];
    expect(selectPrimaryTrailerVideo(rows)?.key).toBe("official");
  });

  it("falls back to teaser when no trailer", () => {
    const rows = [
      {
        type: "Teaser",
        key: "t1",
        site: "YouTube",
        official: true,
        published_at: "2026-02-01T00:00:00.000Z",
      },
      {
        type: "Teaser",
        key: "t0",
        site: "YouTube",
        official: true,
        published_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    expect(selectPrimaryTrailerKey(rows)).toBe("t1");
  });

  it("extractVideoRowsFromMediaVideos reads results wrapper", () => {
    const wrapped = {
      results: [{ type: "Trailer", key: "k", site: "YouTube", official: true }],
    };
    expect(
      selectPrimaryTrailerKey(extractVideoRowsFromMediaVideos(wrapped)),
    ).toBe("k");
  });
});
