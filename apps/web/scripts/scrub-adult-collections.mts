import { readFile, rename, writeFile } from "node:fs/promises";

const CATALOG = new URL("../data/collections/catalog.json", import.meta.url);
const TMDB_URL = "https://api.themoviedb.org/3";
const BATCH_SIZE = 10;
const ADULT_NAME_PATTERN =
  /\b(adult|erotic|erotica|porn|pornographic|xxx|nude|nudity|sex|sexual|softcore|hardcore|hentai|pinku|pink film|emmanuelle|deep throat)\b/i;

type Part = { id: number; title: string };
type Entry = {
  id: number;
  name: string;
  overview?: string;
  parts: Part[];
};

const apiKey = process.env.TMDB_API_KEY;
if (!apiKey) throw new Error("TMDB_API_KEY is required");

const ADULT_KEYWORDS =
  /\b(erotic|erotica|porn|pornography|pinku|pink film|rape|raped|incest|molest|molestation|molester|prostitution|softcore|hardcore|hentai|x-rated)\b/i;

async function hasAdultKeywords(id: number): Promise<boolean | null> {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const response = await fetch(
    `${TMDB_URL}/movie/${id}/keywords?api_key=${apiKey}`,
  );
  if (!response.ok) return null;
  const data = (await response.json()) as {
    keywords?: { name?: string }[];
  };
  const result = (data.keywords ?? []).some((keyword) =>
    ADULT_KEYWORDS.test(keyword.name ?? ""),
  );
  cache.set(id, result);
  return result;
}

const cache = new Map<number, boolean>();
const CACHE_PATH = new URL("./adult-keyword-cache.json", CATALOG);

async function loadCache() {
  try {
    const raw = JSON.parse(await readFile(CACHE_PATH, "utf8")) as Record<
      string,
      boolean
    >;
    for (const [id, value] of Object.entries(raw)) cache.set(Number(id), value);
  } catch {
    // A missing cache file simply means a cold start.
  }
}

async function saveCache() {
  await writeFile(CACHE_PATH, `${JSON.stringify(Object.fromEntries(cache))}\n`);
}

async function main() {
  await loadCache();
  const catalog = JSON.parse(await readFile(CATALOG, "utf8")) as Entry[];

  const nameFlagged = new Set<number>();
  for (const entry of catalog) {
    if (ADULT_NAME_PATTERN.test(entry.name)) {
      for (const part of entry.parts) nameFlagged.add(part.id);
    }
  }

  const keywordAdultParts = new Set<number>();
  const remaining = catalog
    .filter((entry) => !nameFlagged.has(entry.parts[0]?.id))
    .flatMap((entry) => entry.parts);

  for (let index = 0; index < remaining.length; index += BATCH_SIZE) {
    const batch = remaining.slice(index, index + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(
        async (part) => [part.id, await hasAdultKeywords(part.id)] as const,
      ),
    );
    for (const [id, adult] of results) {
      if (adult) keywordAdultParts.add(id);
    }
    console.log(
      `Keyword-checked ${Math.min(index + BATCH_SIZE, remaining.length)}/${remaining.length}`,
    );
  }

  const flaggedParts = new Set<number>([...nameFlagged, ...keywordAdultParts]);

  const removed: string[] = [];
  const filtered = catalog.filter((entry) => {
    const nameHit = ADULT_NAME_PATTERN.test(entry.name);
    const flaggedCount = entry.parts.filter((part) =>
      flaggedParts.has(part.id),
    ).length;
    const remove = nameHit || flaggedCount / entry.parts.length >= 0.5;
    if (remove) {
      removed.push(
        `${entry.name} (${flaggedCount}/${entry.parts.length} parts flagged)`,
      );
    }
    return !remove;
  });

  await saveCache();
  const temporary = new URL("./catalog.json.tmp", CATALOG);
  await writeFile(temporary, `${JSON.stringify(filtered, null, 2)}\n`);
  await rename(temporary, CATALOG);
  console.log(`Removed ${removed.length} collections:`);
  for (const name of removed) console.log(`  - ${name}`);
  console.log(`Wrote ${filtered.length} collections to ${CATALOG.pathname}`);
}

await main();
