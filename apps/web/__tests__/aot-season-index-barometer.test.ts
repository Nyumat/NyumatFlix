import { describe, expect, it } from "vitest";

import { resolveSegmentEpisodeCoords } from "@/lib/anime/resolve-segment-episode-coords";
import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";
import { seasonIndexLookupKey } from "@/lib/anime/season-index-types";
import {
  AOT_TMDB_SHOW_ID,
  aotBarometerCases,
} from "./fixtures/aot-mapping-fixtures";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const seasonIndexPath = path.join(
  process.cwd(),
  "data/anime-mappings/season-index.json",
);

describe("precomputed AOT season index barometer", () => {
  it.skipIf(!existsSync(seasonIndexPath))(
    "matches bundled season-index.json when mappings are present locally",
    () => {
      const index = JSON.parse(
        readFileSync(seasonIndexPath, "utf8"),
      ) as {
        entries: Record<
          string,
          { segments: Array<{ anilistMediaId: number }> }
        >;
      };

      for (const testCase of aotBarometerCases) {
        const entry =
          index.entries[
            seasonIndexLookupKey(AOT_TMDB_SHOW_ID, testCase.seasonNumber)
          ];
        expect(entry, `missing season ${testCase.seasonNumber}`).toBeDefined();

        const segmentCoords = resolveSegmentEpisodeCoords({
          segments: entry.segments as MappingSegment[],
          tmdbEpisodeNumber: testCase.episodeNumber,
        });

        expect(segmentCoords?.anilistId).toBe(testCase.anilistId);
        expect(segmentCoords?.relativeEpisodeNumber).toBe(
          testCase.relativeEpisodeNumber,
        );
      }
    },
  );
});
