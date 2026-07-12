import { createDecipheriv } from "node:crypto";
import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../fetch";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import { looksLikeHlsStreamUrl } from "../stream-url-patterns";
import { validateStreamUrlWithReferers } from "../validate-stream";

const VIDROCK_ORIGIN = "https://vidrock.net";

/** Static AES-256-GCM key embedded in VidRock frontend bundle. */
const VIDROCK_AES_KEY = Buffer.from(
  "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f",
  "hex",
);

type VidrockEntry = {
  url?: string | null;
  type?: string | null;
  language?: string | null;
};

type VidrockPayload = Record<string, VidrockEntry | null | undefined>;

type DecryptedSource = {
  name: string;
  type: "hls" | "mp4" | "unknown";
  url: string;
};

const buildApiUrl = (input: ScrapeMediaInput): string => {
  if (input.mediaType === "movie") {
    return `${VIDROCK_ORIGIN}/api/movie/${input.tmdbId}`;
  }

  return `${VIDROCK_ORIGIN}/api/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
};

export const decryptVidrockUrl = (token: string): string => {
  const raw = Buffer.from(token, "base64url");
  if (raw.length <= 28) {
    throw new Error("VidRock ciphertext too short");
  }

  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(12, raw.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", VIDROCK_AES_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};

const classifyType = (
  declared: string | null | undefined,
  url: string,
): DecryptedSource["type"] => {
  if (declared === "hls" || looksLikeHlsStreamUrl(url) || /\.m3u8/i.test(url)) {
    return "hls";
  }
  if (declared === "mp4" || /\.mp4(?:[?#]|$)/i.test(url)) {
    return "mp4";
  }
  return "unknown";
};

const sourcePriority = (source: DecryptedSource): number => {
  if (source.type === "hls") {
    if (/orion/i.test(source.name)) return 100;
    if (/luna/i.test(source.name)) return 90;
    return 80;
  }
  if (source.type === "mp4") {
    if (/astra/i.test(source.name)) return 50;
    if (/atlas/i.test(source.name)) return 40;
    return 30;
  }
  return 0;
};

const decryptPayload = (payload: VidrockPayload): DecryptedSource[] => {
  const sources: DecryptedSource[] = [];

  for (const [name, entry] of Object.entries(payload)) {
    if (!entry?.url) {
      continue;
    }

    try {
      const url = decryptVidrockUrl(entry.url);
      sources.push({
        name,
        type: classifyType(entry.type, url),
        url,
      });
    } catch {
      // skip undecryptable slots
    }
  }

  return sources.sort((a, b) => sourcePriority(b) - sourcePriority(a));
};

const resolveMp4Playlist = async (
  playlistUrl: string,
): Promise<string | null> => {
  const response = await scrapeFetch(playlistUrl, {
    headers: {
      Accept: "application/json,*/*",
      Referer: `${VIDROCK_ORIGIN}/`,
      Origin: VIDROCK_ORIGIN,
    },
  });

  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("json") || body.trimStart().startsWith("[")) {
    try {
      const rows = JSON.parse(body) as Array<{
        resolution?: number;
        url?: string;
      }>;
      const ranked = [...rows]
        .filter((row) => Boolean(row.url))
        .sort((a, b) => (b.resolution ?? 0) - (a.resolution ?? 0));
      return ranked[0]?.url ?? null;
    } catch {
      return null;
    }
  }

  if (body.includes("#EXTM3U")) {
    return playlistUrl;
  }

  return null;
};

export async function scrapeVidrock(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vidrock" as const;

  try {
    const api = await scrapeFetchText(buildApiUrl(input), {
      Accept: "application/json",
      Referer: `${VIDROCK_ORIGIN}/`,
      Origin: VIDROCK_ORIGIN,
    });

    if (api.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `VidRock API failed (${api.status})`,
      };
    }

    let payload: VidrockPayload;
    try {
      payload = JSON.parse(api.text) as VidrockPayload;
    } catch {
      return {
        ok: false,
        providerId,
        error: "VidRock API returned invalid JSON",
      };
    }

    const sources = decryptPayload(payload);
    if (sources.length === 0) {
      return {
        ok: false,
        providerId,
        error: "VidRock returned no decryptable sources",
      };
    }

    for (const source of sources) {
      let streamUrl = source.url;
      let streamKindHint = source.type;

      if (
        source.type === "mp4" &&
        !/\.mp4(?:[?#]|$)/i.test(source.url) &&
        /\/playlist\//i.test(source.url)
      ) {
        const resolved = await resolveMp4Playlist(source.url);
        if (!resolved) {
          continue;
        }
        streamUrl = resolved;
        streamKindHint = /\.m3u8/i.test(resolved) ? "hls" : "mp4";
      }

      const referer = `${VIDROCK_ORIGIN}/`;
      const kind =
        streamKindHint === "mp4" || /\.mp4(?:[?#]|$)/i.test(streamUrl)
          ? "mp4"
          : "hls";

      // Workers sometimes return 200 HTML under an mpegurl content-type for
      // missing titles — validate before accepting, then try the next source.
      const validation = await validateStreamUrlWithReferers(
        streamUrl,
        referer,
        kind,
        { depth: "full" },
      );
      if (!validation.ok) {
        continue;
      }

      return {
        ok: true,
        providerId,
        validated: true,
        streamUrl,
        referer: validation.referer ?? referer,
      };
    }

    return {
      ok: false,
      providerId,
      error: "VidRock sources failed to resolve",
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "VidRock scrape failed",
    };
  }
}
