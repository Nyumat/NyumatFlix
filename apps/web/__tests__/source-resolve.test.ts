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
  shouldFinalizeFirstPreferenceMatch,
  shouldFinalizeFirstPreferenceMatchWithStartup,
  shouldFinalizeRaceWinner,
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

  it("waits for all pending providers when scorePayload is set", () => {
    const animeOrder = ["justanime", "kickassanime"] as const;
    const winner = shouldFinalizeBatchWinner(
      animeOrder,
      [
        {
          providerId: "justanime",
          attempt: { outcome: "success", payload: { dub: false } },
        },
      ],
      new Set(["kickassanime"]),
      (payload: { dub: boolean }) => (payload.dub ? 2_000 : 100),
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

  it("picks the highest-scoring provider when scorePayload is set", () => {
    const animeOrder = ["justanime", "kickassanime", "anizone"] as const;
    const winner = shouldFinalizeBatchWinner(
      animeOrder,
      [
        {
          providerId: "justanime",
          attempt: { outcome: "success", payload: { dub: false } },
        },
        {
          providerId: "kickassanime",
          attempt: { outcome: "success", payload: { dub: true } },
        },
      ],
      new Set(),
      (payload: { dub: boolean }) => (payload.dub ? 2_000 : 100),
    );
    expect(winner?.providerId).toBe("kickassanime");
  });
});

describe("shouldFinalizeFirstPreferenceMatch", () => {
  it("returns the first success that satisfies hard prefs", () => {
    const winner = shouldFinalizeFirstPreferenceMatch(
      [
        {
          providerId: "justanime",
          attempt: { outcome: "success", payload: { ok: false } },
        },
        {
          providerId: "kickassanime",
          attempt: { outcome: "success", payload: { ok: true } },
        },
      ],
      (payload: { ok: boolean }) => payload.ok,
    );

    expect(winner?.providerId).toBe("kickassanime");
  });
});

describe("shouldFinalizeFirstPreferenceMatchWithStartup", () => {
  it("requires a passing startup probe", () => {
    const winner = shouldFinalizeFirstPreferenceMatchWithStartup(
      [
        {
          providerId: "justanime",
          attempt: {
            outcome: "success",
            payload: { ok: true, startupProbeOk: false, startupProbeMs: 200 },
          },
        },
        {
          providerId: "anizone",
          attempt: {
            outcome: "success",
            payload: { ok: true, startupProbeOk: true, startupProbeMs: 900 },
          },
        },
      ],
      (payload: { ok: boolean }) => payload.ok,
    );

    expect(winner?.providerId).toBe("anizone");
  });

  it("takes the first dub that already passed startup even if an earlier source is still probing", () => {
    const winner = shouldFinalizeFirstPreferenceMatchWithStartup(
      [
        {
          providerId: "vidking",
          attempt: {
            outcome: "success",
            payload: { dub: false, startupProbeOk: true, startupProbeMs: 200 },
          },
        },
        {
          providerId: "kickassanime",
          attempt: {
            outcome: "success",
            payload: { dub: true, startupProbeOk: true, startupProbeMs: 800 },
          },
        },
      ],
      (payload: { dub: boolean }) => payload.dub,
    );

    expect(winner?.providerId).toBe("kickassanime");
  });
});

describe("shouldFinalizeRaceWinner", () => {
  it("finalizes the first success without waiting for siblings", () => {
    const winner = shouldFinalizeRaceWinner([
      {
        providerId: "bingr",
        attempt: { outcome: "success", payload: { id: 1 } },
      },
      {
        providerId: "videasy",
        attempt: { outcome: "success", payload: { id: 2 } },
      },
    ]);
    expect(winner?.providerId).toBe("bingr");
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
