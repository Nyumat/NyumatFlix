import { describe, expect, it } from "vitest";

import {
  pickCatPlayerServer,
  rankKaaServers,
  matchKaaEpisodeSlug,
  kaaEpisodeListPageCount,
} from "@/lib/scrape/anime/providers/kickassanime";
import { rankAnizoneStreamCandidates } from "@/lib/scrape/anime/providers/anizone";
import { trySourcesUntil } from "@/lib/scrape/source-resolve";

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

  it("walks ranked servers until a probe accepts one", async () => {
    const ranked = rankKaaServers([
      { name: "dead", src: "https://example.com/embed?source=vidstream" },
      { name: "live", src: "https://krussdomi.com/cat-player" },
    ]);

    const winner = await trySourcesUntil(ranked, async (server) =>
      server.name === "live"
        ? { ok: true, value: server }
        : { ok: false },
    );

    expect(winner?.name).toBe("live");
  });
});

describe("kickassanime episode lists", () => {
  it("matches episode numbers from strings and later pages", () => {
    expect(
      matchKaaEpisodeSlug(
        [{ slug: "aot-1", episode_number: "1" }],
        1,
      ),
    ).toBe("ep-1-aot-1");
    expect(
      matchKaaEpisodeSlug(
        [
          { slug: "aot-30", episode_number: 30 },
          { slug: "aot-31", episode_number: "31" },
        ],
        31,
      ),
    ).toBe("ep-31-aot-31");
  });

  it("reads advertised page counts", () => {
    expect(kaaEpisodeListPageCount({ pages: 4 })).toBe(4);
    expect(kaaEpisodeListPageCount({ last_page: "3" })).toBe(3);
    expect(kaaEpisodeListPageCount({})).toBe(1);
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
