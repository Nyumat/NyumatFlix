import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AniBridgeSeasonMappings } from "../lib/anime/anibridge-season-segments";
import { buildSeasonIndex } from "../lib/anime/season-segment-merge";
import { buildTmdbAnilistLookup } from "../lib/anime/tmdb-anilist-lookup";
import { TMDB_SHOW_TO_ANILIST_OVERRIDES } from "../lib/anime/mapping-overrides";
import type { FribbMappingItem } from "../lib/fribb-core";
import { parseFribbAnimeList } from "../lib/fribb-core";

const FRIBB_BUNDLED_FILE = "anime-list-mini.json";
const ANIBRIDGE_BUNDLED_FILE = "mappings.min.json";
const SEASON_INDEX_FILE = "season-index.json";
const TMDB_ANILIST_LOOKUP_FILE = "tmdb-anilist-lookup.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const targetDir = path.join(root, "data/anime-mappings");

const readJson = <T,>(filename: string): T => {
  const filePath = path.join(targetDir, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
};

const mappings = readJson<AniBridgeSeasonMappings>(ANIBRIDGE_BUNDLED_FILE);
const fribbRows = parseFribbAnimeList(
  readJson<FribbMappingItem[]>(FRIBB_BUNDLED_FILE),
);

const index = buildSeasonIndex({
  mappings,
  fribbRows,
  generatedAt: new Date().toISOString(),
});

const indexOutputPath = path.join(targetDir, SEASON_INDEX_FILE);
fs.writeFileSync(indexOutputPath, JSON.stringify(index));

console.log(
  `[build-season-index] wrote ${SEASON_INDEX_FILE} (${Object.keys(index.entries).length} seasons)`,
);

// Flat TMDB -> AniList lookup (AniBridge > Fribb). MAL-index and override
// precedence is applied at runtime/cache time; overrides are baked in here so
// catalog enrichment and resolvers share one source of truth.
const lookup = buildTmdbAnilistLookup({
  mappings,
  fribbRows,
  overrides: TMDB_SHOW_TO_ANILIST_OVERRIDES,
  generatedAt: new Date().toISOString(),
});

const lookupOutputPath = path.join(targetDir, TMDB_ANILIST_LOOKUP_FILE);
fs.writeFileSync(lookupOutputPath, JSON.stringify(lookup));

console.log(
  `[build-season-index] wrote ${TMDB_ANILIST_LOOKUP_FILE} (${Object.keys(lookup.tv).length} tv seasons, ${Object.keys(lookup.movie).length} movies)`,
);
