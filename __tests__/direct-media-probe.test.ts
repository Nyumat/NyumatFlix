import { describe, expect, it } from "vitest";

import {
  isDirectBrowserMedia,
  isExtendedContainerMedia,
  looksLikeMp4,
  looksLikeMkv,
} from "@/lib/scrape/direct-media-probe";

const MP4_SAMPLE = new Uint8Array([
  0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
]);
const MKV_SAMPLE = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, 0xa3, 0x42, 0x86, 0x81,
]);

describe("direct-media-probe", () => {
  it("detects mp4 magic bytes", () => {
    expect(looksLikeMp4(MP4_SAMPLE)).toBe(true);
    expect(looksLikeMkv(MP4_SAMPLE)).toBe(false);
  });

  it("detects mkv magic bytes", () => {
    expect(looksLikeMkv(MKV_SAMPLE)).toBe(true);
    expect(looksLikeMp4(MKV_SAMPLE)).toBe(false);
  });

  it("accepts direct browser media only for mp4", () => {
    expect(isDirectBrowserMedia("video/mp4", MP4_SAMPLE)).toBe(true);
    expect(isDirectBrowserMedia("text/plain; charset=UTF-8", MKV_SAMPLE)).toBe(
      false,
    );
  });

  it("accepts extended container media for mkv", () => {
    expect(
      isExtendedContainerMedia("text/plain; charset=UTF-8", MKV_SAMPLE),
    ).toBe(true);
  });
});
