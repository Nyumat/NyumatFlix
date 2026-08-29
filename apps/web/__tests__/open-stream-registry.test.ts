import { afterEach, describe, expect, it } from "vitest";

import {
  isAllowedOpenStreamHost,
  isAllowedOpenStreamUrl,
  resetOpenStreamRegistry,
} from "@/lib/live/open-stream-registry";

describe("open stream registry", () => {
  afterEach(() => {
    resetOpenStreamRegistry();
  });

  it("allows jmp2.uk Pluto source urls without prior registration", () => {
    expect(
      isAllowedOpenStreamUrl(
        "https://jmp2.uk/plu-62ba60f059624e000781c436.m3u8",
      ),
    ).toBe(true);
  });

  it("allows Pluto CDN hosts via trusted jmp2.uk redirect chain", () => {
    expect(isAllowedOpenStreamHost("stitcher-ipv4.pluto.tv")).toBe(true);
    expect(isAllowedOpenStreamHost("mcdn-01.plutotv.net")).toBe(true);
    expect(
      isAllowedOpenStreamUrl(
        "https://stitcher-ipv4.pluto.tv/v2/stitch/embed/hls/channel/65d92a8c8b24c80008e285c0/master.m3u8",
      ),
    ).toBe(true);
    expect(
      isAllowedOpenStreamUrl(
        "https://mcdn-01.plutotv.net/live/v1/prd/BBCNews/ts_aes/segment.ts",
      ),
    ).toBe(true);
  });

  it("rejects unrelated stream hosts", () => {
    expect(isAllowedOpenStreamHost("evil.example.com")).toBe(false);
    expect(isAllowedOpenStreamUrl("https://evil.example.com/stream.m3u8")).toBe(
      false,
    );
  });
});
