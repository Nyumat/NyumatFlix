import { describe, expect, it } from "vitest";

import {
  buildVidsrcMirrorApiUrl,
  parseVidsrcMirrorBody,
} from "@/lib/scrape/providers/vidsrc-mirror";

const sampleEmbedHtml = `
<iframe id="player_iframe" src="//cloudorchestranova.com/rcp/abc123" frameborder="0"></iframe>
`;

const samplePlayerHtml = `
<script>
master_urls = "https://app2.putgate.com/cdnstr/token/list.m3u8?token=__TOKENPG__"
</script>
`;

const extractIframeSrc = (html: string): string | null => {
  const playerIframeTag = html.match(
    /<iframe\b[^>]*\bid=["']player_iframe["'][^>]*>/i,
  );
  if (playerIframeTag?.[0]) {
    const srcMatch = playerIframeTag[0].match(/\bsrc=["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      const trimmed = srcMatch[1].trim();
      if (trimmed.startsWith("//")) {
        return `https:${trimmed}`;
      }
      if (trimmed.startsWith("http")) {
        return trimmed;
      }
    }
  }
  return null;
};

const extractMasterUrl = (html: string): string | null => {
  const match = html.match(/master_urls\s*=\s*"([^"]+)"/);
  if (!match?.[1]) {
    return null;
  }
  const candidate = match[1].split(" or ")[0]?.trim();
  return candidate?.includes(".m3u8") ? candidate : null;
};

describe("vidsrc scrape helpers", () => {
  it("extracts player_iframe src from embed HTML", () => {
    expect(extractIframeSrc(sampleEmbedHtml)).toBe(
      "https://cloudorchestranova.com/rcp/abc123",
    );
  });

  it("extracts master playlist template from player HTML", () => {
    expect(extractMasterUrl(samplePlayerHtml)).toBe(
      "https://app2.putgate.com/cdnstr/token/list.m3u8?token=__TOKENPG__",
    );
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
