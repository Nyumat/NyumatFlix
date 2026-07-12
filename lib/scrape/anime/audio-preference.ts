import type { AnimeScrapeInput } from "./types";

export const preferredAudioLangForTranslation = (
  translationType: AnimeScrapeInput["translationType"] | undefined,
): string | undefined => {
  if (translationType === "dub") {
    return "eng";
  }
  if (translationType === "sub") {
    return "jpn";
  }
  return undefined;
};
