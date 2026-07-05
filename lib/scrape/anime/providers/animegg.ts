import { extractFirstMatch } from "../html-utils";
import { resolveAnimeSearchQuery } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetch, scrapeFetchText } from "../../fetch";

const ANIMEGG_ORIGIN = "https://www.animegg.org";

const slugifySeries = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function scrapeAnimegg(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animegg" as const;

  try {
    const query = await resolveAnimeSearchQuery(input);
    const seriesSlug = slugifySeries(query);
    const episodeSlug = `${seriesSlug}-episode-${input.episodeNumber}`;

    let episodePage = await scrapeFetchText(
      `${ANIMEGG_ORIGIN}/${episodeSlug}`,
      { Referer: `${ANIMEGG_ORIGIN}/` },
    );

    if (episodePage.status !== 200) {
      episodePage = await scrapeFetchText(
        `${ANIMEGG_ORIGIN}/series/${seriesSlug}`,
        { Referer: `${ANIMEGG_ORIGIN}/` },
      );

      const fallbackEpisode = extractFirstMatch(
        episodePage.text,
        new RegExp(`href="/${seriesSlug}-episode-${input.episodeNumber}"`),
      );

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

    const embedId = extractFirstMatch(episodePage.text, /\/embed\/(\d+)/);
    if (!embedId) {
      return { ok: false, providerId, error: "AnimeGG embed id missing" };
    }

    const embedPage = await scrapeFetchText(
      `${ANIMEGG_ORIGIN}/embed/${embedId}`,
      { Referer: `${ANIMEGG_ORIGIN}/` },
    );

    const playPath = extractFirstMatch(
      embedPage.text,
      /(\/play\/\d+\/video\.mp4[^"']*)/,
    );

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

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: "mp4",
      referer: ANIMEGG_ORIGIN,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AnimeGG scrape failed",
    };
  }
}
