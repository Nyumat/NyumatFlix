import { describe, expect, it } from "vitest";

import {
  extractEncDecPlayableStreams,
  mapEncDecQualities,
  rankEncDecStreams,
} from "@/lib/scrape/enc-dec/stream-extract";
import { buildVidlinkApiUrl } from "@/lib/scrape/providers/vidlink";
import { encryptVidlinkMediaId } from "@/lib/scrape/vidlink-cipher";
import { buildHexaApiUrl } from "@/lib/scrape/providers/hexa";
import { megaupMediaUrlFromEmbed } from "@/lib/scrape/megaup-cipher-core";
import { pickKaiSourcePath } from "@/lib/scrape/anime/animekai-helpers";

describe("stream extract", () => {
  it("collects nested HLS sources and prefers higher quality", () => {
    const streams = extractEncDecPlayableStreams(
      {
        sources: [
          { quality: "720p", url: "https://cdn.example/720/master.m3u8" },
          { quality: "1080p", url: "https://cdn.example/1080/master.m3u8" },
        ],
      },
      "https://vidlink.pro/",
    );

    expect(streams.map((stream) => stream.url)).toEqual([
      "https://cdn.example/1080/master.m3u8",
      "https://cdn.example/720/master.m3u8",
    ]);
  });

  it("maps alternate qualities excluding the primary stream", () => {
    const streams = rankEncDecStreams([
      { url: "https://cdn.example/a.m3u8", label: "1080p" },
      { url: "https://cdn.example/b.m3u8", label: "720p" },
    ]);

    expect(
      mapEncDecQualities(streams, "https://cdn.example/a.m3u8", "https://ref/"),
    ).toEqual([
      {
        label: "720p",
        url: "https://cdn.example/b.m3u8",
        referer: "https://ref/",
      },
    ]);
  });
});

describe("vidlink helpers", () => {
  it("builds movie and tv api urls from encrypted ids", () => {
    expect(
      buildVidlinkApiUrl({ mediaType: "movie", tmdbId: 550 }, "enc-id"),
    ).toBe("https://vidlink.pro/api/b/movie/enc-id");
    expect(
      buildVidlinkApiUrl(
        {
          mediaType: "tv",
          tmdbId: 1399,
          seasonNumber: 1,
          episodeNumber: 2,
        },
        "enc-id",
      ),
    ).toBe("https://vidlink.pro/api/b/tv/enc-id/1/2");
  });

  it("builds native VidLink route tokens without enc-dec", () => {
    const token = encryptVidlinkMediaId(550);
    expect(token.length).toBeGreaterThan(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.startsWith("AAAAAAAAAAAAAAAAAAAAAAAA")).toBe(true);
  });
});

describe("hexa helpers", () => {
  it("builds tmdb movie and episode api urls", () => {
    expect(buildHexaApiUrl({ mediaType: "movie", tmdbId: 550 })).toBe(
      "https://theemoviedb.hexa.su/api/tmdb/movie/550/images",
    );
    expect(
      buildHexaApiUrl({
        mediaType: "tv",
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toBe(
      "https://theemoviedb.hexa.su/api/tmdb/tv/1399/season/1/episode/1/images",
    );
  });
});

describe("megaup helpers", () => {
  it("rewrites embed urls to media endpoints", () => {
    expect(megaupMediaUrlFromEmbed("https://megaup.site/e/abc123/stream")).toBe(
      "https://megaup.site/media/abc123/stream",
    );
  });
});

describe("animekai db helpers", () => {
  it("picks softsub paths from enc-dec kai db entries", () => {
    const path = pickKaiSourcePath(
      {
        episodes: {
          "1": {
            "3": {
              sources: {
                softsub: { server1: "/media/abc" },
                dub: { server1: "/media/dub" },
              },
            },
          },
        },
      },
      { anilistId: 1, episodeNumber: 3, translationType: "sub" },
    );

    expect(path).toBe("/media/abc");
  });
});
