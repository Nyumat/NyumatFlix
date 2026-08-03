import { describe, expect, it } from "vitest";

import {
  looksLikeHlsStreamUrl,
  looksLikeStreamUrl,
} from "@/lib/scrape/stream-url-patterns";
import { refererForVidnestStream } from "@/lib/scrape/vidnest-shared";

describe("stream url patterns", () => {
  it("recognizes AllAnime Yt-mp4 / S-mp4 progressive URLs without .mp4", () => {
    expect(
      looksLikeStreamUrl(
        "https://tools.fast4speed.rsvp/media9/videos/ReooPAxPMsHM4KPMY/sub/1168_x?Authorization=abc",
        "mp4",
      ),
    ).toBe(true);
    expect(
      looksLikeStreamUrl(
        "https://webnext975.sharepoint.com/sites/mil/_layouts/15/download.aspx?UniqueId=abc&tempauth=v1.x",
        "mp4",
      ),
    ).toBe(true);
  });

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

  it("recognizes ani.pm extensionless HLS masters", () => {
    expect(
      looksLikeHlsStreamUrl(
        "https://ani.pm/api/anime/src/hls?t=bSgdj4vkaEjrkp8GnbOcp6I3",
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
