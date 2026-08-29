import { describe, expect, it } from "vitest";

import { decodeObfuscatedHlsBody } from "@/lib/scrape/hls-body";

describe("decodeObfuscatedHlsBody", () => {
  it("decodes base64-encoded HLS manifests from Megaplay-style CDNs", () => {
    const encoded = Buffer.from(
      "#EXTM3U\n#EXTINF:5.547,\nseg-00001.txt\n",
      "utf8",
    ).toString("base64");

    expect(decodeObfuscatedHlsBody(encoded)).toBe(
      "#EXTM3U\n#EXTINF:5.547,\nseg-00001.txt\n",
    );
  });

  it("decodes base64-encoded WebVTT subtitles", () => {
    const encoded = Buffer.from(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n",
      "utf8",
    ).toString("base64");

    expect(decodeObfuscatedHlsBody(encoded)).toContain("WEBVTT");
    expect(decodeObfuscatedHlsBody(encoded)).toContain("Hello");
  });

  it("leaves plain manifests unchanged", () => {
    const plain = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nindex.m3u8\n";
    expect(decodeObfuscatedHlsBody(plain)).toBe(plain);
  });
});
