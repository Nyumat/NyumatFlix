import {
  decodeBase64Loose,
  extractDataUrlAttributes,
  extractM3u8Urls,
} from "../html-utils";
import { resolveAnimeSearchQuery } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetchText } from "../../fetch";

const ANIMESTREAM_ORIGIN = "https://animestream.my.id";

const slugifySeries = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function scrapeAnimestream(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animestream" as const;

  try {
    const query = await resolveAnimeSearchQuery(input);
    const slug = slugifySeries(query);
    const episodePath = `/${slug}/episode-${input.episodeNumber}`;

    const episodePage = await scrapeFetchText(
      `${ANIMESTREAM_ORIGIN}${episodePath}`,
      { Referer: `${ANIMESTREAM_ORIGIN}/` },
    );

    if (episodePage.status === 404) {
      return {
        ok: false,
        providerId,
        error: `AnimeStream episode page not found (${episodePath})`,
      };
    }

    if (episodePage.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `AnimeStream episode failed (${episodePage.status})`,
      };
    }

    const dataUrls = extractDataUrlAttributes(episodePage.text);
    const decodedPaths = dataUrls
      .map((value) => decodeBase64Loose(value))
      .filter(Boolean);

    const playerPath = decodedPaths.find((path) =>
      path.startsWith("/player?url="),
    );

    if (!playerPath) {
      return {
        ok: false,
        providerId,
        error: "AnimeStream player path missing",
      };
    }

    const playerPage = await scrapeFetchText(
      `${ANIMESTREAM_ORIGIN}${playerPath}`,
      { Referer: `${ANIMESTREAM_ORIGIN}/` },
    );

    const streamUrls = extractM3u8Urls(playerPage.text);
    const master =
      streamUrls.find((url) => url.includes("master.m3u8")) ?? streamUrls[0];

    if (!master) {
      return {
        ok: false,
        providerId,
        error: "AnimeStream m3u8 not found in player wrapper",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl: master,
      streamKind: "hls",
      referer: ANIMESTREAM_ORIGIN,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error ? error.message : "AnimeStream scrape failed",
    };
  }
}
