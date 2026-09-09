import { trackMatchesLanguage } from "@/lib/playback/track-matching";
import type { ScrapeSubtitle } from "@/lib/scrape/types";

const DASH_STARTUP_SUBTITLE_CAP = 3;

const isEnglishSubtitle = (track: ScrapeSubtitle): boolean =>
  trackMatchesLanguage({ lang: track.lang }, "English") ||
  /^en(?:[-_]|$)/i.test(track.lang.trim());

export const trimDashStartupSubtitles = (
  subtitles: ScrapeSubtitle[] | undefined,
  preferredLang?: string,
): ScrapeSubtitle[] | undefined => {
  if (!subtitles?.length || subtitles.length <= DASH_STARTUP_SUBTITLE_CAP) {
    return subtitles;
  }

  const preferred: ScrapeSubtitle[] = [];
  const english: ScrapeSubtitle[] = [];
  const rest: ScrapeSubtitle[] = [];

  for (const track of subtitles) {
    if (
      preferredLang &&
      trackMatchesLanguage({ lang: track.lang }, preferredLang)
    ) {
      preferred.push(track);
      continue;
    }

    if (isEnglishSubtitle(track)) {
      english.push(track);
      continue;
    }

    rest.push(track);
  }

  return [...preferred, ...english, ...rest].slice(
    0,
    DASH_STARTUP_SUBTITLE_CAP,
  );
};
