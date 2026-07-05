import { scrapeFetchText } from "../fetch";
import { fetchSub1x2Subtitles } from "../subtitles";
import type { ScrapeMediaInput, ScrapeResult } from "../types";

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

    const streamSource = sources.find((source) => {
      const file = source.file ?? source.url ?? "";
      return (
        file.startsWith("http") &&
        !file.includes("/video/error") &&
        (file.includes(".m3u8") ||
          file.includes("cf-master") ||
          file.includes(".txt"))
      );
    });

    const streamUrl = streamSource?.file ?? streamSource?.url;
    if (!streamUrl) {
      return { ok: false, providerId, error: "XPass stream source missing" };
    }

    const subtitles = await fetchSub1x2Subtitles(input);

    return {
      ok: true,
      providerId,
      streamUrl,
      referer: XPASS_ORIGIN,
      qualities: sources
        .map((source) => ({
          label: source.label ?? "auto",
          url: source.file ?? source.url ?? "",
        }))
        .filter((source) => source.url.startsWith("http")),
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
