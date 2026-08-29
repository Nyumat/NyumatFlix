import { describe, expect, it } from "vitest";

import {
  pickBestDirectMovieStream,
  rankDirectMovieStreamsForPlayback,
} from "@calluspirates/shared";
import { rewriteStreamsResponse } from "@/lib/direct/client-streams";
import type { DirectStream } from "@nyumatflix/playback";

describe("direct movie stream rank", () => {
  it("prefers browser-playable direct mp4 over extended remux", () => {
    const streams: DirectStream[] = [
      {
        name: "Hoppers 2160p REMUX",
        resolution: "2160p",
        fileName: "Hoppers.2160p.Blu-ray.Remux.mkv",
        playback: "extended",
        cached: true,
        hash: "a",
        url: "/api/media?u=remux",
        size: 50_000_000_000,
      },
      {
        name: "Hoppers 1080p TorBox",
        resolution: "1080p",
        fileName: "Hoppers.1080p.mp4",
        playback: "direct",
        browserPlayable: true,
        cached: true,
        hash: "b",
        url: "/api/media?u=mp4",
        size: 2_000_000_000,
      },
    ];

    const ranked = rankDirectMovieStreamsForPlayback(streams);
    expect(ranked[0]?.playback).toBe("direct");
    expect(pickBestDirectMovieStream(streams)?.hash).toBe("b");
  });

  it("prefers lighter extended encode before heavy remux among cached streams", () => {
    const streams: DirectStream[] = [
      {
        name: "Hoppers 2160p REMUX",
        resolution: "2160p",
        fileName: "Hoppers.2160p.Blu-ray.Remux.mkv",
        playback: "extended",
        cached: true,
        hash: "remux",
        url: "/api/media?u=remux",
        size: 48_000_000_000,
      },
      {
        name: "Hoppers 2026.mkv",
        resolution: "2160p",
        fileName: "Hoppers 2026.mkv",
        playback: "extended",
        cached: true,
        hash: "encode",
        url: "/api/media?u=encode",
        size: 25_600_000_000,
      },
    ];

    const ranked = rankDirectMovieStreamsForPlayback(streams);
    expect(ranked[0]?.hash).toBe("encode");
  });

  it("drops uncached streams when cached alternatives exist", () => {
    const streams: DirectStream[] = [
      {
        name: "Uncached REMUX",
        resolution: "2160p",
        playback: "extended",
        cached: false,
        hash: "uncached",
        url: "/api/media?u=uncached",
        size: 1000,
      },
      {
        name: "Cached encode",
        resolution: "1080p",
        playback: "extended",
        cached: true,
        hash: "cached",
        url: "/api/media?u=cached",
        size: 5_000_000_000,
      },
    ];

    const ranked = rankDirectMovieStreamsForPlayback(streams);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.hash).toBe("cached");
  });

  it("excludes stereoscopic releases from playback candidates", () => {
    const streams: DirectStream[] = [
      {
        name: "Shrek 2 3D 2004 1080p H-OU Multi BluRay",
        resolution: "1080p",
        playback: "extended",
        cached: true,
        hash: "3d",
        url: "/api/media?u=3d",
        size: 6_000_000_000,
      },
      {
        name: "Shrek 2 2004 1080p BluRay",
        resolution: "1080p",
        playback: "extended",
        cached: true,
        hash: "2d",
        url: "/api/media?u=2d",
        size: 7_000_000_000,
      },
    ];

    const ranked = rankDirectMovieStreamsForPlayback(streams);
    expect(ranked.map((stream) => stream.hash)).toEqual(["2d"]);
  });

  it("removes stereoscopic releases from direct proxy responses", () => {
    const response = rewriteStreamsResponse("https://calluspirates.com", {
      streams: [
        {
          name: "Movie.1080p.HSBS.BluRay",
          resolution: "1080p",
          playback: "extended",
          cached: true,
          hash: "3d",
          url: "/api/media?u=3d",
          size: 1,
        },
        {
          name: "Movie.1080p.BluRay",
          resolution: "1080p",
          playback: "extended",
          cached: true,
          hash: "2d",
          url: "/api/media?u=2d",
          size: 1,
        },
      ],
    });

    expect(response.streams.map((stream) => stream.hash)).toEqual(["2d"]);
  });
});
