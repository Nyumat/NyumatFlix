import { describe, expect, it } from "vitest";

import {
  pickCatPlayerServer,
  rankKaaServers,
} from "@/lib/scrape/anime/providers/kickassanime";
import { rankAnizoneStreamCandidates } from "@/lib/scrape/anime/providers/anizone";

describe("kickassanime server ranking", () => {
  it("prefers vidstream servers but keeps the full ordered list", () => {
    const servers = [
      { name: "backup", src: "https://example.com/embed?source=other" },
      {
        name: "vidstream",
        src: "https://example.com/embed?source=vidstream",
      },
    ];

    expect(rankKaaServers(servers).map((server) => server.name)).toEqual([
      "vidstream",
      "backup",
    ]);
    expect(pickCatPlayerServer(servers)?.name).toBe("vidstream");
  });
});

describe("anizone stream ranking", () => {
  it("prefers player src and master playlists before other urls", () => {
    expect(
      rankAnizoneStreamCandidates("https://cdn.example/master.m3u8", [
        "https://cdn.example/alt.m3u8",
        "https://cdn.example/master.m3u8",
      ]),
    ).toEqual([
      "https://cdn.example/master.m3u8",
      "https://cdn.example/alt.m3u8",
    ]);
  });
});
