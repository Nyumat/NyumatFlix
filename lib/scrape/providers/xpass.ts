import { scrapeFetchText } from "../fetch";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  probeScrapePlaybackPath,
} from "../playback-probe";
import { firstOkInBatches } from "../race-first";
import { rankSourcesHlsFirst } from "../source-resolve";
import {
  decryptXPassDataResponse,
  extractXPassDataUrl,
  playlistPathsFromXPassBackups,
} from "../xpass-data";
import type { ScrapeMediaInput, ScrapeQuality, ScrapeResult } from "../types";
import { scrapeVidSrcMirrorEmbed } from "./vidsrc";

const XPASS_ORIGIN = "https://play.xpass.top";
const TWOEMBED_API = "https://api.2embed.cc";

type TwoEmbedMovie = {
  imdb_id?: string;
};

type XPassPlaylist = {
  playlist?: Array<{
    sources?: Array<{
      file?: string;
      url?: string;
      label?: string;
      type?: string;
    }>;
  }>;
};

const PLAYLIST_PATH_FALLBACK =
  /(?:mvid|meg\/(?:tv|movie)|vip|mdata|vxr|vrk)\/[^"'\s<>]+\/playlist\.json/g;

const MAX_XPASS_PLAYLISTS = 12;
export const XPASS_PLAYABLE_CANDIDATE_BATCH = 3;

const xpassFetchOptions = {
  timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
};

type XPassBackupEntry = {
  url?: unknown;
};

const pushPlaylistPath = (paths: string[], seen: Set<string>, raw: string) => {
  const path = raw.replace(/^\//, "");
  if (!path.includes("playlist.json") || seen.has(path)) {
    return;
  }
  seen.add(path);
  paths.push(path);
};

export const extractXPassPlaylistPaths = (html: string): string[] => {
  const paths: string[] = [];
  const seen = new Set<string>();

  const playlistMatch = html.match(
    /"playlist"\s*:\s*"(\/?[^"]+\/playlist\.json)"/,
  );
  if (playlistMatch?.[1]) {
    pushPlaylistPath(paths, seen, playlistMatch[1]);
  }

  const backupsMatch = html.match(/var backups=(\[[\s\S]*?\])\s*<\/script>/);
  if (backupsMatch?.[1]) {
    try {
      const backups = JSON.parse(backupsMatch[1]) as XPassBackupEntry[];
      for (const backup of backups) {
        if (typeof backup.url === "string") {
          pushPlaylistPath(paths, seen, backup.url);
        }
      }
    } catch {
      void 0;
    }
  }

  for (const match of html.matchAll(PLAYLIST_PATH_FALLBACK)) {
    if (match[0]) {
      pushPlaylistPath(paths, seen, match[0]);
    }
  }

  return paths.slice(0, MAX_XPASS_PLAYLISTS);
};

export const extractXPassPlaylistPath = (html: string): string | null =>
  extractXPassPlaylistPaths(html)[0] ?? null;

const resolveXPassPlaylistPaths = async (
  embedHtml: string,
  embedPageUrl: string,
): Promise<string[]> => {
  const inlinePaths = extractXPassPlaylistPaths(embedHtml);
  if (inlinePaths.length > 0) {
    return inlinePaths;
  }

  const dataUrlPath = extractXPassDataUrl(embedHtml);
  if (!dataUrlPath) {
    return [];
  }

  const dataUrl = new URL(dataUrlPath, XPASS_ORIGIN);
  const token = dataUrl.searchParams.get("token");
  if (!token) {
    return [];
  }

  let encrypted: { status: number; text: string };
  try {
    encrypted = await scrapeFetchText(
      dataUrl.toString(),
      {
        Referer: embedPageUrl,
        Accept: "*/*",
      },
      xpassFetchOptions,
    );
  } catch {
    return [];
  }

  if (encrypted.status !== 200 || encrypted.text.trim().length === 0) {
    return [];
  }

  try {
    const hostname = dataUrl.hostname.toLowerCase();
    const backups = await decryptXPassDataResponse(encrypted.text, {
      hostname,
      dataPathname: dataUrl.pathname,
      token,
      embedContext: embedPageUrl,
    });
    return playlistPathsFromXPassBackups(backups).slice(0, MAX_XPASS_PLAYLISTS);
  } catch {
    return [];
  }
};

const resolveImdbId = async (
  input: ScrapeMediaInput,
): Promise<string | null> => {
  const response = await scrapeFetchText(
    `${TWOEMBED_API}/movie?tmdb_id=${input.tmdbId}`,
    { Accept: "application/json" },
    xpassFetchOptions,
  );

  if (response.status !== 200) {
    return null;
  }

  try {
    const payload = JSON.parse(response.text) as TwoEmbedMovie;
    return payload.imdb_id ?? null;
  } catch {
    return null;
  }
};

/** TV embeds use TMDB ids — IMDB paths can resolve to tmdb 0 on niche/anime titles. */
export const buildXPassEmbedPath = (
  input: ScrapeMediaInput,
  imdbId: string | null,
): string | null => {
  if (input.mediaType === "movie") {
    if (!imdbId) {
      return null;
    }
    return `e/movie/${imdbId}?autostart=true`;
  }

  return `e/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}?autostart=true`;
};

const isPlayableCandidate = (file: string): boolean =>
  file.startsWith("http") &&
  !file.includes("/video/error") &&
  (file.includes(".m3u8") ||
    file.includes("cf-master") ||
    file.includes(".txt") ||
    file.includes("1x2.space") ||
    file.includes("m3u8-proxy") ||
    file.includes("/enproxy/") ||
    file.includes("/pl/"));

const tryVidSrcMirrorFallback = async (
  input: ScrapeMediaInput,
  error: string,
): Promise<ScrapeResult> => {
  const alternate = await scrapeVidSrcMirrorEmbed(input);
  return alternate.ok
    ? { ...alternate, providerId: "2embed" }
    : { ok: false, providerId: "2embed", error };
};

export async function scrapeXPass(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "2embed";

  try {
    const imdbId =
      input.mediaType === "movie" ? await resolveImdbId(input) : null;

    const embedPath = buildXPassEmbedPath(input, imdbId);
    if (!embedPath) {
      return { ok: false, providerId, error: "2Embed IMDB id not found" };
    }

    const embedPageUrl = `${XPASS_ORIGIN}/${embedPath}`;

    const embedPage = await scrapeFetchText(
      embedPageUrl,
      {
        Referer: `${XPASS_ORIGIN}/`,
      },
      xpassFetchOptions,
    );

    if (embedPage.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `XPass embed failed (${embedPage.status})`,
      };
    }

    const playlistPaths = await resolveXPassPlaylistPaths(
      embedPage.text,
      embedPageUrl,
    );
    if (playlistPaths.length === 0) {
      return tryVidSrcMirrorFallback(input, "XPass playlist path missing");
    }

    const rankedCandidates: ScrapeQuality[] = [];
    const seenUrls = new Set<string>();

    for (const playlistPath of playlistPaths) {
      let playlistResponse: { status: number; text: string };
      try {
        playlistResponse = await scrapeFetchText(
          `${XPASS_ORIGIN}/${playlistPath}`,
          {
            Referer: embedPageUrl,
            Accept: "application/json",
          },
          xpassFetchOptions,
        );
      } catch {
        continue;
      }

      if (playlistResponse.status !== 200) {
        continue;
      }

      let payload: XPassPlaylist;
      try {
        payload = JSON.parse(playlistResponse.text) as XPassPlaylist;
      } catch {
        continue;
      }

      const sources =
        payload.playlist?.flatMap((entry) => entry.sources ?? []) ?? [];
      const streamSources = rankSourcesHlsFirst(
        sources.filter((source) =>
          isPlayableCandidate(source.file ?? source.url ?? ""),
        ),
        (source) => source.file ?? source.url ?? null,
      );

      for (const source of streamSources) {
        const candidate = source.file ?? source.url ?? "";
        if (!candidate || seenUrls.has(candidate)) {
          continue;
        }
        seenUrls.add(candidate);
        rankedCandidates.push({
          label:
            source.label?.trim() || `Source ${rankedCandidates.length + 1}`,
          url: candidate,
          referer: XPASS_ORIGIN,
        });
      }
    }

    const winner = await firstOkInBatches(
      rankedCandidates,
      async (quality) => {
        const ok = await probeScrapePlaybackPath(
          {
            url: quality.url,
            referer: quality.referer ?? XPASS_ORIGIN,
          },
          "hls",
        );
        return ok ? quality : null;
      },
      XPASS_PLAYABLE_CANDIDATE_BATCH,
    );

    if (!winner) {
      return tryVidSrcMirrorFallback(
        input,
        "2Embed returned no playable internal servers",
      );
    }

    const alternates = rankedCandidates.filter(
      (quality) => quality.url !== winner.item.url,
    );

    return {
      ok: true,
      providerId,
      streamUrl: winner.item.url,
      validated: true,
      referer: winner.item.referer ?? XPASS_ORIGIN,
      qualities: alternates.length > 0 ? alternates : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error
          ? error.message
          : "XPass scrape failed unexpectedly",
    };
  }
}
