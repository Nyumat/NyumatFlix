import { access, readFile } from "node:fs/promises";
import path from "node:path";

const MAPPINGS_DIR = path.join(process.cwd(), "data/anime-mappings");

export const FRIBB_BUNDLED_FILE = "anime-list-mini.json";
export const ANIBRIDGE_BUNDLED_FILE = "mappings.min.json";

export const readBundledJson = async <T>(
  filename: string,
): Promise<T | null> => {
  const filePath = path.join(MAPPINGS_DIR, filename);
  try {
    await access(filePath);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};
