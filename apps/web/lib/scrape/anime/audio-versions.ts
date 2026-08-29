import type { ScrapeAudioVersion, ScrapeSubtitle } from "../types";
import type { AnimeTranslationType } from "./types";

export type AnimeSubDubStream = {
  url: string;
  subtitles?: ScrapeSubtitle[];
};

/**
 * Both translations of one episode as in-player audio choices (the "Audio"
 * section in playback settings). Requires both streams — with only one
 * there is nothing to switch to and the menu stays hidden.
 */
export const buildSubDubAudioVersions = (input: {
  sub: AnimeSubDubStream | null | undefined;
  dub: AnimeSubDubStream | null | undefined;
}): ScrapeAudioVersion[] | undefined => {
  if (!input.sub?.url || !input.dub?.url) {
    return undefined;
  }

  // Same URL means one multi-audio manifest (e.g. KAA masters carry both
  // tracks) — the player's native audio-track menu handles that; a custom
  // menu that swaps to the identical URL would only restart playback.
  if (input.sub.url === input.dub.url) {
    return undefined;
  }

  return [
    {
      lang: "ja",
      label: "Japanese (Sub)",
      url: input.sub.url,
      original: true,
      subtitles: input.sub.subtitles,
    },
    {
      lang: "en",
      label: "English (Dub)",
      url: input.dub.url,
      subtitles: input.dub.subtitles,
    },
  ];
};

export const defaultAudioLangForTranslation = (
  translationType: AnimeTranslationType | undefined,
): string => (translationType === "dub" ? "en" : "ja");
