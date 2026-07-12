import { scrapeFetchText } from "../fetch";
import { attachSubtitlesToQualities } from "../linked-config";
import { fetchSub1x2Subtitles } from "../subtitles";
import type { ScrapeMediaInput, ScrapeQuality, ScrapeResult } from "../types";
import { validateStreamUrlWithReferers } from "../validate-stream";
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
  /(?:mvid|meg\/(?:tv|movie)|vip|mdata|vxr|vrk)\/[^"'\s<>]+\/playlist\.json/;

export const extractXPassPlaylistPath = (html: string): string | null => {
  const playlistMatch = html.match(
    /"playlist"\s*:\s*"(\/?[^"]+\/playlist\.json)"/,
  );
  if (playlistMatch?.[1]) {
    return playlistMatch[1].replace(/^\//, "");
  }

  const fallbackMatch = html.match(PLAYLIST_PATH_FALLBACK);
  return fallbackMatch?.[0] ?? null;
};

const resolveImdbId = async (
  input: ScrapeMediaInput,
): Promise<string | null> => {
  const response = await scrapeFetchText(
    `${TWOEMBED_API}/movie?tmdb_id=${input.tmdbId}`,
    { Accept: "application/json" },
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

const resolveTvImdbId = async (
  input: ScrapeMediaInput,
): Promise<string | null> => {
  const response = await scrapeFetchText(
    `${TWOEMBED_API}/tv?tmdb_id=${input.tmdbId}`,
    { Accept: "application/json" },
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

const isPlayableCandidate = (file: string): boolean =>
  file.startsWith("http") &&
  !file.includes("/video/error") &&
  (file.includes(".m3u8") ||
    file.includes("cf-master") ||
    file.includes(".txt") ||
    file.includes("1x2.space/playlist"));

export async function scrapeXPass(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "2embed";

  try {
    const imdbId =
      input.mediaType === "movie"
        ? await resolveImdbId(input)
        : await resolveTvImdbId(input);

    if (!imdbId) {
      return { ok: false, providerId, error: "2Embed IMDB id not found" };
    }

    const embedPath =
      input.mediaType === "movie"
        ? `e/movie/${imdbId}?autostart=true`
        : `e/tv/${imdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}?autostart=true`;

    const embedPage = await scrapeFetchText(`${XPASS_ORIGIN}/${embedPath}`, {
      Referer: `${XPASS_ORIGIN}/`,
    });

    if (embedPage.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `XPass embed failed (${embedPage.status})`,
      };
    }

    const playlistPath = extractXPassPlaylistPath(embedPage.text);
    if (!playlistPath) {
      return { ok: false, providerId, error: "XPass playlist path missing" };
    }

    const playlistResponse = await scrapeFetchText(
      `${XPASS_ORIGIN}/${playlistPath}`,
      {
        Referer: `${XPASS_ORIGIN}/`,
        Accept: "application/json",
      },
    );

    if (playlistResponse.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `XPass playlist failed (${playlistResponse.status})`,
      };
    }

    const payload = JSON.parse(playlistResponse.text) as XPassPlaylist;
    const sources =
      payload.playlist?.flatMap((entry) => entry.sources ?? []) ?? [];

    const streamSources = sources.filter((source) =>
      isPlayableCandidate(source.file ?? source.url ?? ""),
    );

    const playable: ScrapeQuality[] = [];
    // Full depth only — TikTok CDN masters look valid but serve PNG "segments".
    for (const source of streamSources) {
      const candidate = source.file ?? source.url ?? "";
      const label = source.label?.trim() || `Source ${playable.length + 1}`;
      if (playable.some((entry) => entry.url === candidate)) {
        continue;
      }
      const validation = await validateStreamUrlWithReferers(
        candidate,
        XPASS_ORIGIN,
        "hls",
        { depth: "full" },
      );
      if (!validation.ok) {
        continue;
      }

      const referer = validation.referer ?? XPASS_ORIGIN;
      // Keep the master/candidate URL — expanding ABR renditions makes the
      // player remount each height on fatal errors (flicker then next source).
      playable.push({ label, url: candidate, referer });
    }

    if (playable.length === 0) {
      const alternate = await scrapeVidSrcMirrorEmbed(input);
      return alternate.ok
        ? { ...alternate, providerId, validated: true }
        : {
            ok: false,
            providerId,
            error: "2Embed returned no playable internal servers",
          };
    }

    const primary = playable[0]!;
    const subtitles = await fetchSub1x2Subtitles(input);

    return {
      ok: true,
      providerId,
      streamUrl: primary.url,
      validated: true,
      referer: primary.referer ?? XPASS_ORIGIN,
      qualities: attachSubtitlesToQualities(
        playable.length > 1 ? playable : undefined,
        subtitles,
      ),
      subtitles: subtitles.length > 0 ? subtitles : undefined,
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
