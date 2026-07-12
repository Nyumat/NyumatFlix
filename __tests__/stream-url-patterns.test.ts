import { describe, expect, it } from "vitest";

import { looksLikeHlsStreamUrl } from "@/lib/scrape/stream-url-patterns";
import { refererForVidnestStream } from "@/lib/scrape/vidnest-shared";

describe("stream url patterns", () => {
  it("recognizes Kyren proxied HLS URLs without .m3u8", () => {
    expect(
      looksLikeHlsStreamUrl("https://api.kyren.moe/v1/hls/m/abc123token"),
    ).toBe(true);
  });

  it("recognizes VixSrc playlist URLs without .m3u8", () => {
    expect(
      looksLikeHlsStreamUrl(
        "https://vixsrc.to/playlist/170060?token=abc&expires=1&h=1",
      ),
    ).toBe(true);
  });

  it("recognizes VidNest goodstream HLS wrapper URLs", () => {
    expect(
      looksLikeHlsStreamUrl(
        "https://goodstream.cc/streamsvr/5N0SvjNwN0/0-21?e=abc",
      ),
    ).toBe(true);
    expect(
      looksLikeHlsStreamUrl(
        "https://goodstream.cc/pl/26dfU0e6eAIE58a/0-21?e=abc",
      ),
    ).toBe(true);
  });

  it("keeps VidNest referer for goodstream URLs", () => {
    expect(
      refererForVidnestStream(
        "https://goodstream.cc/streamsvr/5N0SvjNwN0/0-21?e=abc",
      ),
    ).toBe("https://goodstream.cc/");
  });
});
