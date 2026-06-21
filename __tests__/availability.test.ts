import { describe, expect, it } from "vitest";

import { getUnavailableReason } from "@/lib/live/availability";

describe("getUnavailableReason", () => {
  it("flags device-specific template urls", () => {
    expect(
      getUnavailableReason(
        "https://wurlfifa.global.transmit.live/hls/example/playlist.m3u8?uid=[DEVICE_ID]&rdid=[IFA]",
      ),
    ).toBe("Device-specific stream URL");
  });

  it("flags missing sources", () => {
    expect(getUnavailableReason(null)).toBe("No stream source");
  });

  it("flags dulo backup hosts", () => {
    expect(getUnavailableReason("https://cdn.dulo.tv/memfs/example.m3u8")).toBe(
      "Unsupported backup source",
    );
  });
});
