import { extractFirstMatch } from "../html-utils";
import {
  fetchAnilistMediaMeta,
  fetchAnilistTitleCandidates,
  resolveAnimeSearchQuery,
} from "../anilist-meta";
import { shouldIncludeHentaigasmProvider } from "../hentaigasm-eligible";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetchText } from "../../fetch";

const HENTAIGASM_ORIGIN = "https://hentaigasm.com";
const HENTAIGASM_REFERER = `${HENTAIGASM_ORIGIN}/`;

export const slugifyHentaigasmTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildHentaigasmEpisodeSlug = (
  seriesSlug: string,
  episodeNumber: number,
): string => `${seriesSlug}-${episodeNumber}-subbed`;

export const extractHentaigasmStreamUrl = (html: string): string | null =>
  extractFirstMatch(
    html,
    /jwplayer\("player_01"\)\.setup\(\{\s*file:\s*"([^"]+)"/,
  ) ??
  extractFirstMatch(html, /file:\s*"(https?:\/\/hgasm\d*\.com\/[^"]+\.mp4)"/i);

export const findHentaigasmEpisodePath = (
  seriesPageHtml: string,
  episodeNumber: number,
): string | null => {
  const absolute = extractFirstMatch(
    seriesPageHtml,
    new RegExp(
      `href="(https://hentaigasm\\.com/[^"]*-${episodeNumber}-subbed/?)"`,
      "i",
    ),
  );
  if (absolute) {
    return absolute.replace(HENTAIGASM_ORIGIN, "");
  }

  return extractFirstMatch(
    seriesPageHtml,
    new RegExp(`href="(/[^"]*-${episodeNumber}-subbed/?)"`, "i"),
  );
};

const uniqueNonEmpty = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

const buildSeriesSlugCandidates = (titles: string[]): string[] => {
  const slugs = titles.flatMap((title) => {
    const base = slugifyHentaigasmTitle(title);
    if (!base) {
      return [];
    }

    const withoutEpisodeSuffix = base.replace(
      /-(?:episode-)?\d+(?:-subbed)?$/,
      "",
    );
    return [base, withoutEpisodeSuffix].filter(Boolean);
  });

  return uniqueNonEmpty(slugs);
};

const buildEpisodePathCandidates = (
  seriesSlugs: string[],
  episodeNumber: number,
): string[] =>
  uniqueNonEmpty(
    seriesSlugs.map(
      (slug) => `/${buildHentaigasmEpisodeSlug(slug, episodeNumber)}/`,
    ),
  );

const resolveEpisodePagePath = async (
  seriesSlugs: string[],
  episodeNumber: number,
): Promise<string | null> => {
  for (const path of buildEpisodePathCandidates(seriesSlugs, episodeNumber)) {
    const episodePage = await scrapeFetchText(`${HENTAIGASM_ORIGIN}${path}`, {
      Referer: HENTAIGASM_REFERER,
    });

    if (
      episodePage.status === 200 &&
      extractHentaigasmStreamUrl(episodePage.text)
    ) {
      return path;
    }
  }

  for (const seriesSlug of seriesSlugs) {
    const seriesPage = await scrapeFetchText(
      `${HENTAIGASM_ORIGIN}/hentai/${seriesSlug}/`,
      { Referer: HENTAIGASM_REFERER },
    );

    if (seriesPage.status !== 200) {
      continue;
    }

    const discoveredPath = findHentaigasmEpisodePath(
      seriesPage.text,
      episodeNumber,
    );
    if (!discoveredPath) {
      continue;
    }

    const normalizedPath = discoveredPath.startsWith("/")
      ? discoveredPath
      : `/${discoveredPath}`;
    const episodePage = await scrapeFetchText(
      `${HENTAIGASM_ORIGIN}${normalizedPath}`,
      { Referer: HENTAIGASM_REFERER },
    );

    if (
      episodePage.status === 200 &&
      extractHentaigasmStreamUrl(episodePage.text)
    ) {
      return normalizedPath.endsWith("/")
        ? normalizedPath
        : `${normalizedPath}/`;
    }
  }

  return null;
};

export async function scrapeHentaigasm(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "hentaigasm" as const;

  try {
    if (input.translationType === "dub") {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm only provides subbed streams",
      };
    }

    const meta = await fetchAnilistMediaMeta(input.anilistId);
    if (!meta || meta.titles.length === 0) {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm title metadata missing",
      };
    }

    if (!shouldIncludeHentaigasmProvider(meta)) {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm is limited to adult or Hentai-genre titles",
      };
    }

    const query = await resolveAnimeSearchQuery(input);
    const titles = uniqueNonEmpty([
      query,
      ...(await fetchAnilistTitleCandidates(input.anilistId)),
      ...meta.titles,
    ]);
    const seriesSlugs = buildSeriesSlugCandidates(titles);

    if (seriesSlugs.length === 0) {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm series slug candidates missing",
      };
    }

    const episodePath = await resolveEpisodePagePath(
      seriesSlugs,
      input.episodeNumber,
    );
    if (!episodePath) {
      return {
        ok: false,
        providerId,
        error: `Hentaigasm episode page not found (episode ${input.episodeNumber})`,
      };
    }

    const episodePage = await scrapeFetchText(
      `${HENTAIGASM_ORIGIN}${episodePath}`,
      { Referer: HENTAIGASM_REFERER },
    );

    if (episodePage.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `Hentaigasm episode page failed (${episodePage.status})`,
      };
    }

    const streamUrl = extractHentaigasmStreamUrl(episodePage.text);
    if (!streamUrl?.startsWith("http")) {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm stream URL missing in player setup",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: "mp4",
      referer: HENTAIGASM_REFERER,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error ? error.message : "Hentaigasm scrape failed",
    };
  }
}
