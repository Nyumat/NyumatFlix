import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AniBridgeSeasonMappings } from "../lib/anime/anibridge-season-segments";
import { buildSeasonIndex } from "../lib/anime/season-segment-merge";
import type { FribbMappingItem } from "../lib/fribb-core";
import { parseFribbAnimeList } from "../lib/fribb-core";

const FRIBB_BUNDLED_FILE = "anime-list-mini.json";
const ANIBRIDGE_BUNDLED_FILE = "mappings.min.json";
const SEASON_INDEX_FILE = "season-index.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const targetDir = path.join(root, "data/anime-mappings");

const readJson = <T>(filename: string): T => {
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

const outputPath = path.join(targetDir, SEASON_INDEX_FILE);
fs.writeFileSync(outputPath, JSON.stringify(index));

console.log(
  `[build-season-index] wrote ${SEASON_INDEX_FILE} (${Object.keys(index.entries).length} seasons)`,
);
