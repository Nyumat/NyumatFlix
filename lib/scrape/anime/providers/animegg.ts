import { extractFirstMatch } from "../html-utils";
import { resolveAnimeSearchQueries } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../../fetch";
import { flareSolverrGet } from "../../flaresolverr";
import {
  animeSearchLabelMatches,
  isExactAnimeTitleMatch,
  stripAnimeSearchMetadata,
} from "../title-match";

const ANIMEGG_ORIGIN = "https://www.animegg.org";

export const extractAnimeggSources = (html: string) =>
  [...html.matchAll(/\{file:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)]
    .map((match) => ({ path: match[1] ?? "", label: match[2] ?? "" }))
    .filter((source) => source.path.startsWith("/play/") && source.label);

export const isUsableAnimeggHtml = (status: number, text: string): boolean =>
  status === 200 &&
  text.length > 2_000 &&
  !/Attention Required|Just a moment/i.test(text) &&
  !/504: Gateway time-out|Error 504/i.test(text) &&
  !/Episode not found|An error occurred/i.test(text);

/** CF challenge only — 200 "Episode not found" shells must not wait on FlareSolverr. */
export const shouldFlareSolveAnimegg = (
  status: number,
  text: string,
): boolean => {
  if (
    /Attention Required|Just a moment|cf-browser-verification|challenge-platform/i.test(
      text,
    )
  ) {
    return true;
  }
  return status === 403 || status === 429 || status === 503;
};

const fetchAnimeggHtml = async (
  url: string,
): Promise<{ status: number; text: string }> => {
  let page: { status: number; text: string } | null = null;
  try {
    page = await scrapeFetchText(
      url,
      { Referer: `${ANIMEGG_ORIGIN}/` },
      { timeoutMs: 12_000 },
    );
    if (isUsableAnimeggHtml(page.status, page.text)) {
      return page;
    }
    if (!shouldFlareSolveAnimegg(page.status, page.text)) {
      return page;
    }
  } catch {
    void 0;
  }

  const flared = await flareSolverrGet(url, 45_000);
  if (flared && isUsableAnimeggHtml(flared.status, flared.body)) {
    return { status: flared.status, text: flared.body };
  }

  return page ?? { status: 0, text: "" };
};

const findSeriesSlugFromSearch = async (
  titles: readonly string[],
): Promise<string | null> => {
  type Candidate = { slug: string; label: string; exact: boolean };

  const candidates: Candidate[] = [];

  for (const title of titles) {
    const searchPage = await fetchAnimeggHtml(
      `${ANIMEGG_ORIGIN}/search/?q=${encodeURIComponent(title)}`,
    );
    for (const match of searchPage.text.matchAll(
      /<a\b[^>]*href="\/series\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      const slug = match[1];
      const label = match[2] ?? "";
      if (!slug || !animeSearchLabelMatches(label, titles)) {
        continue;
      }
      const cleaned = stripAnimeSearchMetadata(label);
      candidates.push({
        slug,
        label: cleaned,
        exact: isExactAnimeTitleMatch(cleaned, titles),
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const exact = candidates.filter((candidate) => candidate.exact);
  const pool = exact.length > 0 ? exact : candidates;
  pool.sort((left, right) => left.slug.length - right.slug.length);
  return pool[0]?.slug ?? null;
};

export async function scrapeAnimegg(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animegg" as const;

  try {
    const titles = await resolveAnimeSearchQueries(input);
    const seriesSlug = await findSeriesSlugFromSearch(titles);
    if (!seriesSlug) {
      return {
        ok: false,
        providerId,
        error: "AnimeGG exact title match not found",
      };
    }
    let episodeSlug = `${seriesSlug}-episode-${input.episodeNumber}`;

    let episodePage = await fetchAnimeggHtml(
      `${ANIMEGG_ORIGIN}/${episodeSlug}`,
    );

    const loadEpisodeFromSeriesPage = async (): Promise<boolean> => {
      const seriesPage = await fetchAnimeggHtml(
        `${ANIMEGG_ORIGIN}/series/${seriesSlug}`,
      );
      const fallbackEpisode = extractFirstMatch(
        seriesPage.text,
        new RegExp(`href="(/[^"]*episode-${input.episodeNumber}(?:-[^"]+)?)"`),
      );
      if (!fallbackEpisode) {
        return false;
      }
      episodeSlug = fallbackEpisode.slice(1);
      episodePage = await fetchAnimeggHtml(`${ANIMEGG_ORIGIN}/${episodeSlug}`);
      return isUsableAnimeggHtml(episodePage.status, episodePage.text);
    };

    if (!isUsableAnimeggHtml(episodePage.status, episodePage.text)) {
      const recovered = await loadEpisodeFromSeriesPage();
      if (!recovered) {
        return {
          ok: false,
          providerId,
          error: `AnimeGG episode page not found (${episodeSlug})`,
        };
      }
    }

    const version = input.translationType === "dub" ? "dubbed" : "subbed";
    const extractEmbedId = (html: string): string | null =>
      extractFirstMatch(
        html,
        new RegExp(
          `data-id=['"](\\d+)['"][^>]*data-mirror=['"]Animegg['"][^>]*data-version=['"]${version}['"]`,
          "i",
        ),
      );

    let embedId = extractEmbedId(episodePage.text);
    if (!embedId) {
      const recovered = await loadEpisodeFromSeriesPage();
      embedId = recovered ? extractEmbedId(episodePage.text) : null;
    }
    if (!embedId) {
      return { ok: false, providerId, error: "AnimeGG embed id missing" };
    }

    const embedPage = await fetchAnimeggHtml(
      `${ANIMEGG_ORIGIN}/embed/${embedId}`,
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

    const resolvePlayUrl = async (path: string): Promise<string> => {
      const absolute = `${ANIMEGG_ORIGIN}${path}`;
      try {
        const playResponse = await scrapeFetch(absolute, {
          method: "GET",
          redirect: "manual",
          headers: { Referer: `${ANIMEGG_ORIGIN}/` },
          retryAttempts: 1,
          timeoutMs: 12_000,
        });
        const redirectUrl = playResponse.headers.get("location");
        await cancelResponseBody(playResponse);
        if (redirectUrl?.startsWith("http")) {
          return redirectUrl;
        }
      } catch {
        void 0;
      }

      // CF / proxy often kills the redirect hop — the /play/ path itself is
      // playable with the AnimeGG referer.
      return absolute;
    };

    const streamUrl = await resolvePlayUrl(playPath);

    const qualities = (
      await Promise.all(
        sources.slice(1).map(async (source) => ({
          label: source.label,
          url: await resolvePlayUrl(source.path),
        })),
      )
    ).filter((quality) => quality.url !== streamUrl);

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
