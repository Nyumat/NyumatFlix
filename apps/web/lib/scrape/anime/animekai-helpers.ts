import type { AnimeScrapeInput } from "./types";
import type { KaiDbEntry } from "./kai-db-bundled";

export const translationToKaiType = (
  translation: AnimeScrapeInput["translationType"],
): string => (translation === "dub" ? "dub" : "softsub");

export const pickKaiSourcePath = (
  entry: KaiDbEntry | null,
  input: AnimeScrapeInput,
): string | null => {
  if (!entry?.episodes) {
    return null;
  }

  const season = "1";
  const episode = String(input.episodeNumber);
  const type = translationToKaiType(input.translationType);
  const episodeNode = entry.episodes[season]?.[episode];
  if (!episodeNode?.sources) {
    return null;
  }

  const typeSources = episodeNode.sources[type] ?? episodeNode.sources.sub;
  if (!typeSources) {
    return null;
  }

  const paths = Object.values(typeSources).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return paths[0] ?? null;
};

export const buildMegaupAbsoluteUrl = (
  mirror: string,
  mediaPath: string,
): string => {
  if (mediaPath.startsWith("http")) {
    return mediaPath;
  }
  return `${mirror.replace(/\/$/, "")}/${mediaPath.replace(/^\//, "")}`;
};
