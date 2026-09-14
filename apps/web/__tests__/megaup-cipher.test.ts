import { describe, expect, it } from "vitest";

import {
  decryptMegaupPayloadCore,
  encryptMegaupPayloadForTest,
  extractMegaupMediaId,
  megaupAgentSlice,
} from "@/lib/scrape/megaup-cipher-core";

const MEGAUP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

describe("megaup-cipher-core", () => {
  it("derives a stable UA slice for the default MegaUp agent", () => {
    const slice = megaupAgentSlice(MEGAUP_USER_AGENT);
    expect(slice.length).toBeGreaterThan(10);
    expect(slice).toMatch(/^[A-Z0-9]+$/);
  });

  it("round-trips XOR payloads with agent and media keystreams", () => {
    const payload = {
      sources: [{ file: "https://cdn.example/stream.m3u8", quality: "auto" }],
      download: "https://cdn.example/dl",
    };
    const mediaId = "i4ToeDn0WS2JcOLyFL5L7BvpCQ";
    const encrypted = encryptMegaupPayloadForTest(payload, {
      userAgent: MEGAUP_USER_AGENT,
      mediaId,
      mode: "agent-media",
    });

    const decrypted = decryptMegaupPayloadCore(encrypted, {
      userAgent: MEGAUP_USER_AGENT,
      mediaId,
    });

    expect(decrypted.sources?.[0]?.file).toBe(payload.sources[0].file);
  });

  it("extracts media ids from absolute and relative paths", () => {
    expect(
      extractMegaupMediaId(
        "https://megaup.nl/media/i4ToeDn0WS2JcOLyFL5L7BvpCQ",
      ),
    ).toBe("i4ToeDn0WS2JcOLyFL5L7BvpCQ");
    expect(extractMegaupMediaId("media/abc123/extra")).toBe("abc123");
  });
});
