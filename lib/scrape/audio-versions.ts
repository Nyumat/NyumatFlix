import type { ScrapeAudioVersion } from "./types";

export const resolveScrapeAudioVariantUrl = (
  audioVersions: ScrapeAudioVersion[],
  audioLang: string,
  hardSubLang: string | "off",
): string | null => {
  const audio = audioVersions.find((version) => version.lang === audioLang);
  if (!audio) {
    return null;
  }

  if (hardSubLang === "off") {
    return audio.url;
  }

  return (
    audio.hardSubs?.find((track) => track.lang === hardSubLang)?.url ??
    audio.url
  );
};
