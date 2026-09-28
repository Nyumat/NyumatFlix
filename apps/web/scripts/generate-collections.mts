import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { createGunzip } from "node:zlib";

const OUTPUT = new URL("../data/collections/catalog.json", import.meta.url);
const today = new Date();
const exportDate = `${String(today.getUTCMonth() + 1).padStart(2, "0")}_${String(today.getUTCDate()).padStart(2, "0")}_${today.getUTCFullYear()}`;
const EXPORT_URL = `https://files.tmdb.org/p/exports/collection_ids_${exportDate}.json.gz`;
const TMDB_URL = "https://api.themoviedb.org/3";
const MIN_PARTS = 4;
const MIN_POPULARITY = 5;
const ADULT_NAME_PATTERN =
  /\b(adult|erotic|erotica|porn|pornographic|xxx|nude|nudity|sex|sexual|softcore|hardcore|hentai|pinku|pink film|emmanuelle|deep throat|grindhouse|pink film)\b/i;
const BATCH_SIZE = 4;
const SEED_IDS = [
  131296, 86311, 1241, 9485, 10, 119, 328, 295, 87359, 8650, 10194, 948, 8091,
  84, 2344, 2150, 468222, 86029, 1575, 77816,
];

type ExportRecord = { id?: number | string };
type Movie = {
  id: number;
  title: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  adult?: boolean;
};
type Collection = {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
  adult?: boolean;
  parts?: Movie[];
};

const apiKey = process.env.TMDB_API_KEY;
if (!apiKey) throw new Error("TMDB_API_KEY is required");

async function* streamExport(): AsyncGenerator<number> {
  const response = await fetch(EXPORT_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Collection export failed: ${response.status}`);
  }
  const stream = Readable.fromWeb(response.body as never).pipe(createGunzip());
  let pending = "";
  for await (const chunk of stream) {
    pending += chunk.toString();
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const record = parseRecord(line);
      if (record !== null) yield record;
    }
  }
  const record = parseRecord(pending);
  if (record !== null) yield record;
}

function parseRecord(line: string): number | null {
  if (!line.trim()) return null;
  try {
    const value = JSON.parse(line) as ExportRecord;
    const id = Number(value.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function fetchCollection(id: number): Promise<Collection | null> {
  const response = await fetch(
    `${TMDB_URL}/collection/${id}?api_key=${apiKey}`,
  );
  if (!response.ok) return null;
  return (await response.json()) as Collection;
}

function normalize(collection: Collection) {
  if (collection.adult) return null;
  if (ADULT_NAME_PATTERN.test(collection.name)) return null;
  if (collection.overview && ADULT_NAME_PATTERN.test(collection.overview)) {
    return null;
  }
  const parts = (collection.parts ?? [])
    .filter((part) => !part.adult)
    .filter(
      (part) =>
        Boolean(part.poster_path) &&
        Boolean(part.release_date) &&
        String(part.release_date).slice(0, 10) <=
          new Date().toISOString().slice(0, 10),
    );
  const popularity = Math.max(
    collection.popularity ?? 0,
    ...parts.map((part) => part.popularity ?? 0),
  );
  if (parts.length < MIN_PARTS || popularity <= MIN_POPULARITY) {
    return null;
  }
  return {
    id: collection.id,
    name: collection.name,
    overview: collection.overview ?? "",
    poster_path: collection.poster_path ?? null,
    backdrop_path: collection.backdrop_path ?? null,
    popularity,
    released_item_count: parts.length,
    parts: parts.map(
      ({ id, title, poster_path, backdrop_path, release_date }) => ({
        id,
        media_type: "movie" as const,
        title,
        poster_path: poster_path as string,
        backdrop_path: backdrop_path ?? undefined,
        release_date: release_date as string,
      }),
    ),
  };
}

async function main() {
  await mkdir(new URL("../data/collections", import.meta.url), {
    recursive: true,
  });
  const ids = new Set<number>();
  if (process.argv.includes("--seed")) {
    for (const id of SEED_IDS) ids.add(id);
  } else {
    for await (const id of streamExport()) ids.add(id);
  }
  const results: NonNullable<ReturnType<typeof normalize>>[] = [];
  const allIds = [...ids];
  for (let index = 0; index < allIds.length; index += BATCH_SIZE) {
    const batch = allIds.slice(index, index + BATCH_SIZE);
    const collections = await Promise.all(batch.map(fetchCollection));
    for (const collection of collections) {
      const normalized = collection ? normalize(collection) : null;
      if (normalized) results.push(normalized);
    }
    console.log(
      `Processed ${Math.min(index + BATCH_SIZE, allIds.length)}/${allIds.length}`,
    );
  }
  results.sort((a, b) => b.popularity - a.popularity || a.id - b.id);
  const temporary = new URL("./catalog.json.tmp", OUTPUT);
  const writer = createWriteStream(temporary);
  writer.write(`${JSON.stringify(results, null, 2)}\n`);
  writer.end();
  await finished(writer);
  await rename(temporary, OUTPUT);
  console.log(
    `Wrote ${results.length} eligible collections to ${OUTPUT.pathname}`,
  );
}

await main().catch(async (error) => {
  try {
    await unlink(new URL("./catalog.json.tmp", OUTPUT));
  } catch {
    // The temporary file may not exist when the export fails early.
  }
  console.error(error);
  process.exitCode = 1;
});
