import { preferredAudioLangForTranslation } from "../audio-preference";
import { extractHtmlSubtitleTracks, extractM3u8Urls } from "../html-utils";
import { searchAnizoneSlug } from "../anizone-livewire";
import { resolveAnimeSearchQueries } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetchText } from "../../fetch";

const ANIZONE_ORIGIN = "https://anizone.to";

export async function scrapeAnizone(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "anizone" as const;

  try {
    const queries = await resolveAnimeSearchQueries(input);
    let slug: string | null = null;
    for (const query of queries) {
      slug = await searchAnizoneSlug(query);
      if (slug) {
        break;
      }
    }

    if (!slug) {
      return { ok: false, providerId, error: "AniZone slug not found" };
    }

    const episode = await scrapeFetchText(
      `${ANIZONE_ORIGIN}/anime/${slug}/${input.episodeNumber}`,
      { Referer: `${ANIZONE_ORIGIN}/` },
    );

    if (episode.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `AniZone episode page failed (${episode.status}: ${slug}/${input.episodeNumber})`,
      };
    }

    const streamUrls = extractM3u8Urls(episode.text);
    const master =
      streamUrls.find((url) => url.includes("master.m3u8")) ?? streamUrls[0];

    if (!master) {
      return {
        ok: false,
        providerId,
        error: "No m3u8 in AniZone episode HTML",
      };
    }

    const subtitles = extractHtmlSubtitleTracks(episode.text);

    return {
      ok: true,
      providerId,
      streamUrl: master,
      streamKind: "hls",
      referer: ANIZONE_ORIGIN,
      subtitles: subtitles.length > 0 ? subtitles : undefined,
      preferredAudioLang: preferredAudioLangForTranslation(
        input.translationType,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AniZone scrape failed",
    };
  }
}
