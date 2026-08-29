import { describe, expect, it } from "vitest";

import {
  isPlayableM3uStreamUrl,
  parseM3uPlaylist,
} from "@/lib/live/m3u-parser";

const SAMPLE_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-id="ESPN.us@SD" tvg-logo="https://example.com/espn.png" group-title="Sports",ESPN
https://stream.example.com/espn/playlist.m3u8
#EXTINF:-1 tvg-id="Bad.us@SD" group-title="Sports",YouTube Stream
https://www.youtube.com/watch?v=123
#EXTINF:-1 tvg-id="HTTP.us@SD" group-title="News",HTTP Stream
http://stream.example.com/news.m3u8
#EXTINF:-1 tvg-id="Agent.us@SD" http-user-agent="CustomAgent/1.0" group-title="News",Agent Channel
#EXTVLCOPT:http-user-agent=FallbackAgent/2.0
https://stream.example.com/agent/playlist.m3u8
`;

describe("m3u parser", () => {
  it("parses valid HLS entries with metadata", () => {
    const entries = parseM3uPlaylist(SAMPLE_PLAYLIST);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      name: "ESPN",
      url: "https://stream.example.com/espn/playlist.m3u8",
      tvgId: "ESPN.us@SD",
      tvgLogo: "https://example.com/espn.png",
      groupTitle: "Sports",
    });
    expect(entries[1]?.userAgent).toBe("CustomAgent/1.0");
  });

  it("rejects non-https and blocked hosts", () => {
    expect(isPlayableM3uStreamUrl("http://stream.example.com/live.m3u8")).toBe(
      false,
    );
    expect(isPlayableM3uStreamUrl("https://www.youtube.com/watch?v=123")).toBe(
      false,
    );
    expect(isPlayableM3uStreamUrl("https://stream.example.com/live.m3u8")).toBe(
      true,
    );
  });
});
