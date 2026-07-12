import { describe, expect, it } from "vitest";

import {
  buildVidsrcStreamUrl,
  isVidsrcCdnHostname,
  isVidsrcMasterPlaybackUrl,
} from "@/lib/scrape/vidsrc-playback";
import type { VidsrcPlaybackRefresh } from "@/lib/scrape/vidsrc-constants";

const sampleRefresh: VidsrcPlaybackRefresh = {
  providerId: "vidsrc",
  tokenHost: "kaleidoscopekernel.space",
  masterTemplate:
    "https://kaleidoscopekernel.space/pl/abc/master.m3u8?token=__TOKEN__",
  playerOrigin: "https://cloudorchestranova.com",
  playerReferer: "https://cloudorchestranova.com/rcp/hash",
};

describe("vidsrc playback refresh", () => {
  it("substitutes JWT into master template", () => {
    expect(buildVidsrcStreamUrl(sampleRefresh.masterTemplate, "jwt-123")).toBe(
      "https://kaleidoscopekernel.space/pl/abc/master.m3u8?token=jwt-123",
    );
    expect(
      buildVidsrcStreamUrl(
        "https://cdn.example/list.m3u8?token=__TOKENPG__",
        "jwt-456",
      ),
    ).toBe("https://cdn.example/list.m3u8?token=jwt-456");
  });

  it("detects VidSrc CDN hostnames", () => {
    expect(isVidsrcCdnHostname("kaleidoscopekernel.space")).toBe(true);
    expect(isVidsrcCdnHostname("vsembed.ru")).toBe(false);
  });

  it("matches master playback URLs by host and path", () => {
    expect(
      isVidsrcMasterPlaybackUrl(
        "https://kaleidoscopekernel.space/pl/abc/master.m3u8?token=old",
        sampleRefresh,
      ),
    ).toBe(true);
    expect(
      isVidsrcMasterPlaybackUrl(
        "https://kaleidoscopekernel.space/pl/abc/segment.jpg",
        sampleRefresh,
      ),
    ).toBe(false);
  });
});
