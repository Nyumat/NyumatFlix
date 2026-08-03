import { describe, expect, it } from "vitest";

import {
  isHlsSourceUrl,
  rankSourcesHlsFirst,
  unwrapProxyUrl,
} from "@/lib/scrape/source-resolve";
import { isVixsrcStubPlaylistBody } from "@/lib/scrape/vixsrc-stub";
import {
  classifySiblingCancel,
  shouldFinalizeBatchWinner,
} from "@/lib/scrape/scrape-race-batch";

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

describe("isVixsrcStubPlaylistBody", () => {
  it("rejects JSON playlist stubs", () => {
    expect(
      isVixsrcStubPlaylistBody(
        "https://vixsrc.to/playlist/123?token=abc",
        '{"playlist":"stub"}',
      ),
    ).toBe(true);
  });

  it("accepts real HLS bodies", () => {
    expect(
      isVixsrcStubPlaylistBody(
        "https://vixsrc.to/playlist/123?token=abc",
        "#EXTM3U\n#EXTINF:10.0,\nseg.ts",
      ),
    ).toBe(false);
  });
});

describe("shouldFinalizeBatchWinner", () => {
  const order = ["bingr", "videasy", "vidking"] as const;

  it("waits for earlier pending providers", () => {
    const winner = shouldFinalizeBatchWinner(
      order,
      [{ providerId: "videasy", attempt: { outcome: "success", payload: {} } }],
      new Set(["bingr"]),
    );
    expect(winner).toBeUndefined();
  });

  it("finalizes when no earlier provider is pending", () => {
    const winner = shouldFinalizeBatchWinner(
      order,
      [
        {
          providerId: "videasy",
          attempt: { outcome: "success", payload: { id: 1 } },
        },
      ],
      new Set(),
    );
    expect(winner?.providerId).toBe("videasy");
  });
});

describe("classifySiblingCancel", () => {
  it("marks winner cancels as skipped", () => {
    expect(classifySiblingCancel("winner")).toBe("skipped");
  });

  it("marks timeout cancels as failure", () => {
    expect(classifySiblingCancel("timeout")).toBe("failure");
  });
});
