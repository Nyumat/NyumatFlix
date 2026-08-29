import { describe, expect, it } from "vitest";

import { isPoisonedHlsPlaylistBody } from "@/lib/scrape/hls-poison";

describe("hls poison detection", () => {
  it("rejects tiktok ad segments masquerading as HLS", () => {
    const body = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:10.010,
https://p16-ttam-va.ibyteimg.com/origin/ad-site-i18n/202510135d0da864362497504c03b7ac
`;

    expect(isPoisonedHlsPlaylistBody(body)).toBe(true);
  });

  it("allows normal relative segment playlists", () => {
    const body = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXTINF:6.0,
segment-0.ts
`;

    expect(isPoisonedHlsPlaylistBody(body)).toBe(false);
  });
});
