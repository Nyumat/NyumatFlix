import { scrapeFetchText } from "./fetch";
import type { ScrapeMediaInput, ScrapeSubtitle } from "./types";

export const SUB1X2_SUBTITLE_ORIGIN = "https://sub.1x2.space";

type Sub1x2SubtitleEntry = {
  label?: string;
  language?: string;
  url?: string;
};

export const buildSub1x2SubtitleApiUrl = (input: ScrapeMediaInput): string => {
  if (input.mediaType === "movie") {
    return `${SUB1X2_SUBTITLE_ORIGIN}/api/movie/${input.tmdbId}`;
  }

  return `${SUB1X2_SUBTITLE_ORIGIN}/api/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
};

export const resolveSub1x2SubtitleUrl = (
  relativeOrAbsolute: string,
): string => {
  if (relativeOrAbsolute.startsWith("http")) {
    return relativeOrAbsolute;
  }

  return `${SUB1X2_SUBTITLE_ORIGIN}${relativeOrAbsolute.startsWith("/") ? relativeOrAbsolute : `/${relativeOrAbsolute}`}`;
};

const parseSub1x2SubtitleEntries = (payload: unknown): ScrapeSubtitle[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.flatMap((entry: Sub1x2SubtitleEntry) => {
    if (!entry.url) {
      return [];
    }

    return [
      {
        lang: entry.label ?? entry.language ?? "und",
        url: resolveSub1x2SubtitleUrl(entry.url),
      },
    ];
  });
};

export async function fetchSub1x2Subtitles(
  input: ScrapeMediaInput,
): Promise<ScrapeSubtitle[]> {
  const response = await scrapeFetchText(buildSub1x2SubtitleApiUrl(input), {
    Accept: "application/json",
  });

  if (response.status !== 200) {
    return [];
  }

  try {
    const payload = JSON.parse(response.text) as unknown;
    return parseSub1x2SubtitleEntries(payload);
  } catch {
    return [];
  }
}
