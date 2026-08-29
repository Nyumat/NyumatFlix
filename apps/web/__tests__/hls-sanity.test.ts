import { describe, expect, it } from "vitest";

import { isBaitHlsPlaylist } from "@/lib/scrape/anime/hls-sanity";

describe("isBaitHlsPlaylist", () => {
  it("flags vivibebe ibyteimg decoys", () => {
    expect(
      isBaitHlsPlaylist(
        "#EXTM3U\n#EXTINF:11.3,\nhttps://p16-ad-sg.ibyteimg.com/obj/ad-site-i18n/x.ts\n",
      ),
    ).toBe(true);
  });

  it("flags image-segment decoys", () => {
    expect(isBaitHlsPlaylist("#EXTM3U\n#EXTINF:4.0,\nsegment-0001.png\n")).toBe(
      true,
    );
    expect(
      isBaitHlsPlaylist(
        "#EXTM3U\n#EXTINF:4.0,\nhttps://cdn.example/seg.jpg?x=1\n",
      ),
    ).toBe(true);
  });

  it("keeps real media playlists", () => {
    expect(
      isBaitHlsPlaylist(
        "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nindex-f1-v1-a1.m3u8\n",
      ),
    ).toBe(false);
    expect(
      isBaitHlsPlaylist("#EXTM3U\n#EXTINF:9.2,\nhttps://cdn.example/seg.ts\n"),
    ).toBe(false);
  });
});
