import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "./types";

/** Prefer audio-version softsubs, then per-quality, then top-level. */
export const resolveActiveSubtitles = (input: {
  topLevel?: ScrapeSubtitle[];
  qualities?: ScrapeQuality[];
  qualityIndex?: number;
  audioVersions?: ScrapeAudioVersion[];
  audioLang?: string;
}): ScrapeSubtitle[] => {
  if (input.audioVersions?.length && input.audioLang) {
    const audio = input.audioVersions.find(
      (version) => version.lang === input.audioLang,
    );
    if (audio?.subtitles?.length) {
      return audio.subtitles;
    }
  }

  if (
    input.qualities?.length &&
    typeof input.qualityIndex === "number" &&
    input.qualityIndex >= 0
  ) {
    const quality = input.qualities[input.qualityIndex];
    if (quality?.subtitles?.length) {
      return quality.subtitles;
    }
  }

  return input.topLevel ?? [];
};

export const attachSubtitlesToQualities = (
  qualities: ScrapeQuality[] | undefined,
  subtitles: ScrapeSubtitle[] | undefined,
): ScrapeQuality[] | undefined => {
  if (!qualities?.length || !subtitles?.length) {
    return qualities;
  }

  return qualities.map((quality) =>
    quality.subtitles?.length
      ? quality
      : {
          ...quality,
          subtitles,
        },
  );
};

export const dedupeSubtitles = (
  subtitles: ScrapeSubtitle[],
): ScrapeSubtitle[] => {
  const seen = new Set<string>();
  const result: ScrapeSubtitle[] = [];

  for (const track of subtitles) {
    const key = `${track.lang}::${track.url}`;
    if (seen.has(key) || !track.url.startsWith("http")) {
      continue;
    }
    seen.add(key);
    result.push(track);
  }

  return result;
};
