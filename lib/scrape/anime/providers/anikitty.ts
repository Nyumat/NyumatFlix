import { preferredAudioLangForTranslation } from "../audio-preference";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeSubtitle } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";

const ANIKITTY_ORIGIN = "https://anikitty.moe";

type AnikittyStreamResponse = {
  file?: string | null;
  headers?: { Referer?: string; Origin?: string; "User-Agent"?: string };
  tracks?: Array<{
    file?: string;
    label?: string;
    kind?: string;
    lang?: string;
  }>;
  error?: string;
};

const extractUpstreamUrl = (proxyOrDirect: string): string => {
  try {
    const parsed = new URL(proxyOrDirect);
    const nested = parsed.searchParams.get("url");
    if (nested && /^https?:\/\//i.test(nested)) {
      return nested;
    }
  } catch {
    // keep original
  }
  return proxyOrDirect;
};

const resolveSubtitleUrl = (file: string): string => {
  if (file.startsWith("http://") || file.startsWith("https://")) {
    return file;
  }
  if (file.startsWith("/")) {
    return `${ANIKITTY_ORIGIN}${file}`;
  }
  return file;
};

const mapSubtitles = (
  tracks: AnikittyStreamResponse["tracks"],
): ScrapeSubtitle[] | undefined => {
  const mapped = (tracks ?? [])
    .filter((track) => Boolean(track.file))
    .map((track) => ({
      lang: track.label ?? track.lang ?? "Unknown",
      url: resolveSubtitleUrl(track.file!),
      format: "vtt" as const,
    }));

  return mapped.length > 0 ? mapped : undefined;
};

const preferReferer = (
  streamUrl: string,
  headers: AnikittyStreamResponse["headers"],
): string => {
  if (headers?.Referer) {
    // Upstream CDN often wants its own host, not the anitaku/proxy hint.
    if (streamUrl.includes("vivibebe.site")) {
      return "https://vivibebe.site/";
    }
    if (streamUrl.includes("mewstream") || streamUrl.includes("megaplay")) {
      return "https://megaplay.buzz/";
    }
    return headers.Referer;
  }

  if (streamUrl.includes("vivibebe.site")) {
    return "https://vivibebe.site/";
  }

  return `${ANIKITTY_ORIGIN}/`;
};

export async function scrapeAnikitty(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "anikitty" as const;
  const audio = input.translationType === "dub" ? "dub" : "sub";

  try {
    const params = new URLSearchParams({
      anilistId: String(input.anilistId),
      episode: String(input.episodeNumber),
      audio,
    });

    const response = await scrapeFetch(
      `${ANIKITTY_ORIGIN}/api/kitty/stream?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          Origin: ANIKITTY_ORIGIN,
          Referer: `${ANIKITTY_ORIGIN}/`,
        },
      },
    );

    if (!response.ok) {
      await cancelResponseBody(response);
      return {
        ok: false,
        providerId,
        error: `AniKitty stream failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as AnikittyStreamResponse;
    if (!payload.file) {
      return {
        ok: false,
        providerId,
        error: payload.error ?? "AniKitty returned no stream file",
      };
    }

    const streamUrl = extractUpstreamUrl(payload.file);
    const referer = preferReferer(streamUrl, payload.headers);

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: "hls",
      referer,
      subtitles: mapSubtitles(payload.tracks),
      preferredAudioLang: preferredAudioLangForTranslation(
        input.translationType,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AniKitty scrape failed",
    };
  }
}
