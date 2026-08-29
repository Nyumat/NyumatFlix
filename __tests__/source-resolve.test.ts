import { describe, expect, it } from "vitest";

import {
  isHlsSourceUrl,
  rankSourcesHlsFirst,
  unwrapProxyUrl,
} from "@/lib/scrape/source-resolve";

describe("unwrapProxyUrl", () => {
  it("peels nested wormhole url params", () => {
    const upstream =
      "https://remoteconsultinggroup.site/abc/pl/H4sIAAAAAAAAAwXB0XaCIBgA4FcCtY7urlraMHAi";
    const nested = `https://wormhole.filmu.in/proxy/m3u8?url=${encodeURIComponent(upstream)}&referer=https%3A%2F%2Fnextgencloudfabric.com%2F`;
    const proxied = `https://wormhole.filmu.in/proxy/m3u8?url=${encodeURIComponent(nested)}`;
    expect(unwrapProxyUrl(proxied)).toBe(upstream);
  });
});

describe("rankSourcesHlsFirst", () => {
  it("prefers HLS sources over MP4", () => {
    const ranked = rankSourcesHlsFirst([
      { url: "https://cdn.example/a.mp4", type: "mp4" },
      { url: "https://cdn.example/master.m3u8", type: "hls" },
    ]);
    expect(ranked[0]?.url).toContain(".m3u8");
  });
});

describe("isHlsSourceUrl", () => {
  it("detects m3u8 paths", () => {
    expect(
      isHlsSourceUrl({ type: "video/mp4" }, "https://cdn.example/stream.m3u8"),
    ).toBe(true);
  });
});
