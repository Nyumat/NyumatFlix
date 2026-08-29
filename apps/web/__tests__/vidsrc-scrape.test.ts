import { describe, expect, it } from "vitest";

import {
  buildVidsrcMirrorApiUrl,
  parseVidsrcMirrorBody,
} from "@/lib/scrape/providers/vidsrc-mirror";
import {
  applyVidsrcStreamToken,
  buildVidsrcStreamApiUrl,
  collectVidsrcStreamUrlCandidates,
  extractIframeSrc,
  parseVidsrcTokenResponse,
} from "@/lib/scrape/providers/vidsrc";

const sampleEmbedHtml = `
<iframe id="player_iframe" src="//cloudorchestranova.com/rcp/abc123" frameborder="0"></iframe>
`;

const sampleNewEmbedHtml = `
<iframe id="player_iframe"
        src="https://cloudorchestranova.com/embed/movie/550?vs=abcToken"
        allow="autoplay; fullscreen"></iframe>
`;

describe("vidsrc scrape helpers", () => {
  it("extracts player_iframe src from embed HTML", () => {
    expect(extractIframeSrc(sampleEmbedHtml)).toBe(
      "https://cloudorchestranova.com/rcp/abc123",
    );
  });

  it("extracts the new /embed/movie iframe src", () => {
    expect(extractIframeSrc(sampleNewEmbedHtml)).toBe(
      "https://cloudorchestranova.com/embed/movie/550?vs=abcToken",
    );
  });

  it("builds the data.vidsrcme.ru stream API urls", () => {
    expect(buildVidsrcStreamApiUrl({ mediaType: "movie", tmdbId: 550 })).toBe(
      "https://data.vidsrcme.ru/api.php?type=movie&tmdb=550&stream_urls",
    );
    expect(
      buildVidsrcStreamApiUrl({
        mediaType: "tv",
        tmdbId: 1396,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toBe(
      "https://data.vidsrcme.ru/api.php?type=tv&tmdb=1396&season=1&episode=1&stream_urls",
    );
  });

  it("collects plaintext stream_urls arrays", () => {
    expect(
      collectVidsrcStreamUrlCandidates({
        data: {
          stream_urls: [
            "https://cdn.example/pl/abc/master.m3u8",
            "https://other.example/pl/def/master.m3u8",
          ],
        },
      }),
    ).toEqual({
      plaintext: [
        "https://cdn.example/pl/abc/master.m3u8",
        "https://other.example/pl/def/master.m3u8",
      ],
      encrypted: null,
      wasmUrl: null,
      wasmInline: null,
    });
  });

  it("splits newline-separated plaintext stream_urls", () => {
    expect(
      collectVidsrcStreamUrlCandidates({
        data: {
          stream_urls: "https://cdn.example/a.m3u8\nhttps://cdn.example/b.m3u8",
        },
      }),
    ).toEqual({
      plaintext: ["https://cdn.example/a.m3u8", "https://cdn.example/b.m3u8"],
      encrypted: null,
      wasmUrl: null,
      wasmInline: null,
    });
  });

  it("keeps encrypted stream_urls with wasm metadata", () => {
    expect(
      collectVidsrcStreamUrlCandidates({
        data: { stream_urls: "KzTHPy+/encrypted" },
        vs: { w: 1, wasm_url: "https://data.vidsrcme.ru/wasm.php?w=1" },
      }),
    ).toEqual({
      plaintext: [],
      encrypted: "KzTHPy+/encrypted",
      wasmUrl: "https://data.vidsrcme.ru/wasm.php?w=1",
      wasmInline: null,
    });
  });

  it("parses JWT token responses including JSON envelopes", () => {
    expect(parseVidsrcTokenResponse(" eyJabc.def ")).toBe("eyJabc.def");
    expect(parseVidsrcTokenResponse('{"token":"eyJfromjson"}')).toBe(
      "eyJfromjson",
    );
    expect(parseVidsrcTokenResponse("<html><h1>429</h1></html>")).toBe("");
  });

  it("appends or substitutes VidSrc stream tokens", () => {
    expect(
      applyVidsrcStreamToken(
        "https://cdn.example/pl/abc/master.m3u8",
        "eyJjwt",
      ),
    ).toBe("https://cdn.example/pl/abc/master.m3u8?token=eyJjwt");
    expect(
      applyVidsrcStreamToken(
        "https://cdn.example/list.m3u8?token=__TOKEN__",
        "eyJjwt",
      ),
    ).toBe("https://cdn.example/list.m3u8?token=eyJjwt");
  });

  it("parses vidsrc.wtf JSON wrapped in HTML", () => {
    const payload = parseVidsrcMirrorBody(
      '<pre>{"stream":{"url":"https://cdn.example/hls.m3u8"}}</pre>',
    );
    expect(payload?.stream?.url).toBe("https://cdn.example/hls.m3u8");
  });

  it("builds vidsrc mirror API urls", () => {
    expect(buildVidsrcMirrorApiUrl({ mediaType: "movie", tmdbId: 550 })).toBe(
      "https://api.vidsrc.wtf/source/movie/550",
    );
    expect(
      buildVidsrcMirrorApiUrl({
        mediaType: "tv",
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toBe("https://api.vidsrc.wtf/source/tv/1399/1/1");
  });
});
