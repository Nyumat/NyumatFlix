import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withAnimePageHref } from "@/lib/anilist-page-hrefs";
import {
  KITSU_FALLBACK_ID_BASE,
  kitsuResourceToAniListMedia,
} from "@/lib/anime-kitsu-fallback";
import { buildMalAnimeDetailHref } from "@/lib/mal/route-id";
import { describe, expect, it } from "vitest";

type AnimeMappingRow = {
  anilist_id?: number;
  kitsu_id?: number;
  mal_id?: number;
  themoviedb_id?: { tv?: number; movie?: number };
};

const mappingPath = join(
  process.cwd(),
  "data/anime-mappings/anime-list-mini.json",
);

const loadMappings = (): AnimeMappingRow[] => {
  const raw = readFileSync(mappingPath, "utf8");
  const parsed = JSON.parse(raw) as AnimeMappingRow[];
  if (!Array.isArray(parsed)) {
    throw new Error("anime-list-mini.json must be an array");
  }
  return parsed;
};

const mappings = loadMappings();

const mappedPairs = mappings.filter(
  (row) =>
    Number.isInteger(row.kitsu_id) &&
    (row.kitsu_id as number) > 0 &&
    Number.isInteger(row.anilist_id) &&
    (row.anilist_id as number) > 0,
);

const kitsuItem = (kitsuId: number) => ({
  id: String(kitsuId),
  type: "anime" as const,
  attributes: {
    canonicalTitle: `Kitsu ${kitsuId}`,
    titles: { en: `Kitsu ${kitsuId}` },
    startDate: "2024-01-01",
    subtype: "TV",
    status: "finished",
    episodeCount: 12,
  },
});

describe("anime provider route audit", () => {
  it(`covers ${mappedPairs.length} kitsu↔anilist mapping rows`, () => {
    expect(mappedPairs.length).toBeGreaterThan(100);
  });

  it("never emits kitsu detail hrefs when Kitsu returned a canonical AniList id", () => {
    const failures: string[] = [];

    for (const row of mappedPairs) {
      const kitsuId = row.kitsu_id as number;
      const anilistId = row.anilist_id as number;
      const media = kitsuResourceToAniListMedia(
        kitsuItem(kitsuId),
        [],
        anilistId,
        row.mal_id ?? null,
      );
      if (!media) {
        failures.push(
          `kitsu-${kitsuId}: kitsuResourceToAniListMedia returned null`,
        );
        continue;
      }

      const item = withAnimePageHref({
        ...media,
        media_type: "tv",
        isAniListFallback: true,
        sourceAnilistId: anilistId,
      });

      const href = item.href;
      if (href.includes(`/anime/kitsu-${kitsuId}`)) {
        failures.push(
          `kitsu-${kitsuId} (anilist-${anilistId}) resolved to ${href}`,
        );
      }
      if (!href.includes(`/anime/anilist-${anilistId}`)) {
        failures.push(
          `kitsu-${kitsuId} (anilist-${anilistId}) expected anilist href, got ${href}`,
        );
      }
    }

    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toEqual([]);
  });

  it("routes unmapped Kitsu sentinel ids to kitsu slugs only", () => {
    const sentinelId = KITSU_FALLBACK_ID_BASE - 48_233;
    const href = withAnimePageHref({
      id: sentinelId,
      media_type: "tv",
      isAniListFallback: true,
    }).href;

    expect(href).toBe("/anime/kitsu-48233");
  });

  it("routes unmapped Jikan sentinel ids to mal slugs", () => {
    const href = withAnimePageHref({
      id: -2_100_052_991,
      media_type: "tv",
      isAniListFallback: true,
    }).href;

    expect(href).toBe(buildMalAnimeDetailHref(52_991));
  });

  it("includes Lord of Mysteries in the mapping corpus", () => {
    const lordOfMysteries = mappedPairs.find((row) => row.kitsu_id === 48_233);
    expect(lordOfMysteries).toEqual(
      expect.objectContaining({
        anilist_id: 137_667,
        mal_id: 49_818,
        themoviedb_id: { tv: 232_230 },
      }),
    );
  });
});
