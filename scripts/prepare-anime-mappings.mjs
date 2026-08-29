import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const targetDir = path.join(root, "data/anime-mappings");

const sources = [
  {
    url: "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json",
    file: "anime-list-mini.json",
  },
  {
    url: "https://github.com/anibridge/anibridge-mappings/releases/download/v3/mappings.min.json",
    file: "mappings.min.json",
  },
];

fs.mkdirSync(targetDir, { recursive: true });

for (const { url, file } of sources) {
  const target = path.join(targetDir, file);
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`failed to download ${url}: ${response.status}`);
  }
  const body = await response.text();
  fs.writeFileSync(target, body);
  console.log(`[prepare-anime-mappings] wrote ${file} (${body.length} bytes)`);
}
