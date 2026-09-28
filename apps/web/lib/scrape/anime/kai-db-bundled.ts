import { access, readFile } from "node:fs/promises";
import path from "node:path";

export type KaiDbEpisodeSources = Record<string, Record<string, string>>;

export type KaiDbEntry = {
  info?: {
    content_id?: string;
    kai_id?: string;
    mirrors?: {
      megaup?: string[];
    };
  };
  episodes?: Record<
    string,
    Record<
      string,
      {
        token?: string;
        sources?: KaiDbEpisodeSources;
      }
    >
  >;
};

const KAI_DB_DIR = path.join(process.cwd(), "data/kai-db/anilist");

export const bundledKaiDbPathForAnilistId = (anilistId: number): string =>
  path.join(KAI_DB_DIR, `${anilistId}.json`);

export const readBundledKaiDbEntry = async (
  anilistId: number,
): Promise<KaiDbEntry | null> => {
  const filePath = bundledKaiDbPathForAnilistId(anilistId);
  try {
    await access(filePath);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as KaiDbEntry | KaiDbEntry[];
    if (Array.isArray(parsed)) {
      return parsed[0] ?? null;
    }
    return parsed ?? null;
  } catch {
    return null;
  }
};
