import { extractFirstMatch } from "../html-utils";
import {
  fetchAnilistTitleCandidates,
  resolveAnimeSearchQuery,
} from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../../fetch";
import { animeSearchLabelMatches } from "../title-match";

const ANIMEGG_ORIGIN = "https://www.animegg.org";

const extractAnimeggSources = (html: string) =>
  [...html.matchAll(/\{file:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)]
    .map((match) => ({ path: match[1] ?? "", label: match[2] ?? "" }))
    .filter((source) => source.path.startsWith("/play/") && source.label);

const findSeriesSlugFromSearch = async (
  titles: readonly string[],
): Promise<string | null> => {
  for (const title of titles) {
    const searchPage = await scrapeFetchText(
      `${ANIMEGG_ORIGIN}/search/?q=${encodeURIComponent(title)}`,
      { Referer: `${ANIMEGG_ORIGIN}/` },
    );
    for (const match of searchPage.text.matchAll(
      /<a\b[^>]*href="\/series\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      const label = match[2] ?? "";
      if (match[1] && animeSearchLabelMatches(label, titles)) return match[1];
    }
  }
  return null;
};

export async function scrapeAnimegg(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animegg" as const;

  try {
    const query = await resolveAnimeSearchQuery(input);
    const seen = new Set<string>();
    const titles: string[] = [];
    for (const title of [
      query,
      ...(await fetchAnilistTitleCandidates(input.anilistId)),
    ]) {
      const trimmed = title.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      titles.push(trimmed);
    }
    const seriesSlug = await findSeriesSlugFromSearch(titles);
    if (!seriesSlug) {
      return {
        ok: false,
        providerId,
        error: "AnimeGG exact title match not found",
      };
    }
    let episodeSlug = `${seriesSlug}-episode-${input.episodeNumber}`;

    let episodePage = await scrapeFetchText(
      `${ANIMEGG_ORIGIN}/${episodeSlug}`,
      { Referer: `${ANIMEGG_ORIGIN}/` },
    );

    if (episodePage.status !== 200) {
      let fallbackEpisode: string | null = null;
      for (const candidateSlug of [seriesSlug]) {
        const seriesPage = await scrapeFetchText(
          `${ANIMEGG_ORIGIN}/series/${candidateSlug}`,
          { Referer: `${ANIMEGG_ORIGIN}/` },
        );
        fallbackEpisode = extractFirstMatch(
          seriesPage.text,
          new RegExp(
            `href="(/[^"]*episode-${input.episodeNumber}(?:-[^"]+)?)"`,
          ),
        );
        if (fallbackEpisode) {
          episodeSlug = fallbackEpisode.slice(1);
          break;
        }
      }

      if (!fallbackEpisode) {
        return {
          ok: false,
          providerId,
          error: `AnimeGG episode page not found (${episodeSlug})`,
        };
      }

      episodePage = await scrapeFetchText(`${ANIMEGG_ORIGIN}/${episodeSlug}`, {
        Referer: `${ANIMEGG_ORIGIN}/`,
      });
    }

    const version = input.translationType === "dub" ? "dubbed" : "subbed";
    const embedId = extractFirstMatch(
      episodePage.text,
      new RegExp(
        `data-id=['"](\\d+)['"][^>]*data-mirror=['"]Animegg['"][^>]*data-version=['"]${version}['"]`,
        "i",
      ),
    );
    if (!embedId) {
      return { ok: false, providerId, error: "AnimeGG embed id missing" };
    }

    const embedPage = await scrapeFetchText(
      `${ANIMEGG_ORIGIN}/embed/${embedId}`,
      { Referer: `${ANIMEGG_ORIGIN}/` },
    );

    const sources = extractAnimeggSources(embedPage.text).sort(
      (left, right) =>
        Number.parseInt(right.label) - Number.parseInt(left.label),
    );
    const playPath =
      sources[0]?.path ??
      extractFirstMatch(embedPage.text, /(\/play\/\d+\/video\.mp4[^"']*)/);

    if (!playPath) {
      return {
        ok: false,
        providerId,
        error: "AnimeGG play URL missing in embed page",
      };
    }

    const playResponse = await scrapeFetch(`${ANIMEGG_ORIGIN}${playPath}`, {
      method: "GET",
      redirect: "manual",
      headers: { Referer: `${ANIMEGG_ORIGIN}/` },
    });

    const redirectUrl = playResponse.headers.get("location");
    await cancelResponseBody(playResponse);
    const streamUrl = redirectUrl?.startsWith("http")
      ? redirectUrl
      : `${ANIMEGG_ORIGIN}${playPath}`;

    const qualities = await Promise.all(
      sources.slice(1).map(async (source) => {
        const response = await scrapeFetch(`${ANIMEGG_ORIGIN}${source.path}`, {
          method: "GET",
          redirect: "manual",
          headers: { Referer: `${ANIMEGG_ORIGIN}/` },
        });
        const location = response.headers.get("location");
        await cancelResponseBody(response);
        return {
          label: source.label,
          url: location?.startsWith("http")
            ? location
            : `${ANIMEGG_ORIGIN}${source.path}`,
        };
      }),
    );

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: "mp4",
      referer: ANIMEGG_ORIGIN,
      qualities: qualities.length > 0 ? qualities : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AnimeGG scrape failed",
    };
  }
}
