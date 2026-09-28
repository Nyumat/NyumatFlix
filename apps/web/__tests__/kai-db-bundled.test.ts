import { describe, expect, it } from "vitest";

import { pickKaiSourcePath } from "@/lib/scrape/anime/animekai-helpers";
import { readBundledKaiDbEntry } from "@/lib/scrape/anime/kai-db-bundled";

describe("bundled kai db", () => {
  it("loads anilist 21 and resolves episode 1 softsub megaup path", async () => {
    const entry = await readBundledKaiDbEntry(21);
    expect(entry?.info?.mirrors?.megaup?.[0]).toMatch(/^https:\/\//);

    const path = pickKaiSourcePath(entry, {
      anilistId: 21,
      episodeNumber: 1,
      translationType: "sub",
    });

    expect(path).toBe("media/i4ToeDn0WS2JcOLyFL5L7BvpCQ");
  });
});
