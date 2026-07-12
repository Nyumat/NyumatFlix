import { scrapeFetchText } from "../fetch";
import type { ScrapeMediaInput, ScrapeResult } from "../types";

const VIXSRC_ORIGIN = "https://vixsrc.to";

const buildApiUrl = (input: ScrapeMediaInput): string => {
  if (input.mediaType === "movie") {
    return `${VIXSRC_ORIGIN}/api/movie/${input.tmdbId}`;
  }

  return `${VIXSRC_ORIGIN}/api/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
};

const absoluteEmbedUrl = (src: string): string => {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  if (src.startsWith("/")) {
    return `${VIXSRC_ORIGIN}${src}`;
  }
  return `${VIXSRC_ORIGIN}/${src}`;
};

const extractPlaylistParams = (
  html: string,
): { videoId: string; token: string; expires: string } | null => {
  const videoId =
    html.match(/window\.video\s*=\s*\{[\s\S]*?\bid:\s*['"](\d+)['"]/)?.[1] ??
    null;
  const token =
    html.match(
      /window\.masterPlaylist\s*=\s*\{[\s\S]*?'token'\s*:\s*'([^']+)'/,
    )?.[1] ??
    html.match(/"token"\s*:\s*"([a-f0-9]+)"/i)?.[1] ??
    null;
  const expires =
    html.match(
      /window\.masterPlaylist\s*=\s*\{[\s\S]*?'expires'\s*:\s*'(\d+)'/,
    )?.[1] ??
    html.match(/"expires"\s*:\s*"?(\d+)"?/)?.[1] ??
    null;

  if (!videoId || !token || !expires) {
    return null;
  }

  return { videoId, token, expires };
};

export async function scrapeVixsrc(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vixsrc" as const;

  try {
    const api = await scrapeFetchText(buildApiUrl(input), {
      Accept: "application/json",
      Referer: `${VIXSRC_ORIGIN}/`,
      Origin: VIXSRC_ORIGIN,
    });

    if (api.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `VixSrc API failed (${api.status})`,
      };
    }

    let src: string | undefined;
    try {
      const payload = JSON.parse(api.text) as { src?: string };
      src = payload.src;
    } catch {
      return {
        ok: false,
        providerId,
        error: "VixSrc API returned invalid JSON",
      };
    }

    if (!src) {
      return { ok: false, providerId, error: "VixSrc API missing embed src" };
    }

    const embedUrl = absoluteEmbedUrl(src);
    const embed = await scrapeFetchText(embedUrl, {
      Referer: `${VIXSRC_ORIGIN}/`,
      Origin: VIXSRC_ORIGIN,
    });

    if (embed.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `VixSrc embed failed (${embed.status})`,
      };
    }

    const params = extractPlaylistParams(embed.text);
    if (!params) {
      return {
        ok: false,
        providerId,
        error: "VixSrc embed missing playlist params",
      };
    }

    const playlistUrl = new URL(`${VIXSRC_ORIGIN}/playlist/${params.videoId}`);
    playlistUrl.searchParams.set("token", params.token);
    playlistUrl.searchParams.set("expires", params.expires);
    playlistUrl.searchParams.set("h", "1");

    const streamUrl = playlistUrl.toString();
    const referer = embedUrl;

    return {
      ok: true,
      providerId,
      streamUrl,
      referer,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "VixSrc scrape failed",
    };
  }
}
