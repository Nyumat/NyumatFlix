import { extractFirstMatch } from "../html-utils";
import {
  fetchAnilistTitleCandidates,
  resolveAnimeSearchQuery,
} from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetch, scrapeFetchText } from "../../fetch";

const ANIMEGG_ORIGIN = "https://www.animegg.org";

const slugifySeries = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
    const slug = extractFirstMatch(searchPage.text, /href="\/series\/([^"]+)"/);
    if (slug) return slug;
  }
  return null;
};

export async function scrapeAnimegg(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animegg" as const;

  try {
    const query = await resolveAnimeSearchQuery(input);
    const titles = [
      query,
      ...(await fetchAnilistTitleCandidates(input.anilistId)),
    ];
    const seriesSlugs = [...new Set(titles.map(slugifySeries))];
    let seriesSlug = seriesSlugs[0] ?? "";
    let episodeSlug = `${seriesSlug}-episode-${input.episodeNumber}`;

    let episodePage = await scrapeFetchText(
      `${ANIMEGG_ORIGIN}/${episodeSlug}`,
      { Referer: `${ANIMEGG_ORIGIN}/` },
    );

    if (episodePage.status !== 200) {
      let fallbackEpisode: string | null = null;
      const searchedSlug = await findSeriesSlugFromSearch(titles);
      for (const candidateSlug of [searchedSlug, ...seriesSlugs].filter(
        (slug): slug is string => Boolean(slug),
      )) {
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
          seriesSlug = candidateSlug;
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
    const embedId =
      extractFirstMatch(
        episodePage.text,
        new RegExp(
          `data-id=['"](\\d+)['"][^>]*data-mirror=['"]Animegg['"][^>]*data-version=['"]${version}['"]`,
          "i",
        ),
      ) ?? extractFirstMatch(episodePage.text, /\/embed\/(\d+)/);
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
