import { scrapeFetch } from "./fetch";
import {
  parseStreamDurationSeconds,
  streamDurationMatchesExpected,
} from "./stream-duration";
import { looksLikeStreamUrl, type StreamKind } from "./stream-url-patterns";

const looksLikeValidBody = (body: string, kind: StreamKind): boolean => {
  if (kind === "hls") {
    return (
      body.includes("#EXTM3U") ||
      body.includes('"playlist"') ||
      body.includes("m3u8") ||
      body.includes("cf-master")
    );
  }

  if (kind === "dash") {
    return body.includes("<MPD") || body.includes("mpd");
  }

  return body.includes("ftyp") || body.length > 0;
};

const okContentTypesForKind = (
  contentType: string,
  kind: StreamKind,
): boolean => {
  const lower = contentType.toLowerCase();

  if (kind === "hls") {
    return (
      lower.includes("mpegurl") ||
      lower.includes("vnd.apple.mpegurl") ||
      lower.includes("json") ||
      lower.includes("text") ||
      lower.includes("octet-stream") ||
      lower.includes("binary") ||
      lower.includes("mp2t")
    );
  }

  return (
    lower.includes("mpegurl") ||
    lower.includes("vnd.apple.mpegurl") ||
    lower.includes("dash") ||
    lower.includes("mp4") ||
    lower.includes("json") ||
    lower.includes("text") ||
    lower.includes("octet-stream") ||
    lower.includes("binary")
  );
};

const HLS_URI_ATTRIBUTE_PATTERN = /\bURI=(?:"([^"]+)"|'([^']+)')/i;

const resolveHlsUrl = (value: string, playlistUrl: string): string | null => {
  try {
    return new URL(value, playlistUrl).toString();
  } catch {
    return null;
  }
};

type HlsProbeTargets = {
  childPlaylist: string | null;
  requiredAssets: string[];
};

export const extractHlsProbeTargets = (
  body: string,
  playlistUrl: string,
): HlsProbeTargets => {
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const requiredAssets: string[] = [];

  for (const line of lines) {
    if (!line.startsWith("#EXT-X-MAP") && !line.startsWith("#EXT-X-KEY")) {
      continue;
    }

    const match = line.match(HLS_URI_ATTRIBUTE_PATTERN);
    const value = match?.[1] ?? match?.[2];
    if (value) {
      const resolved = resolveHlsUrl(value, playlistUrl);
      if (resolved && !requiredAssets.includes(resolved)) {
        requiredAssets.push(resolved);
      }
    }
  }

  let childPlaylist: string | null = null;
  for (const line of lines) {
    if (line && !line.startsWith("#")) {
      const resolved = resolveHlsUrl(line, playlistUrl);
      if (!resolved) {
        continue;
      }

      if (body.includes("#EXT-X-STREAM-INF")) {
        childPlaylist = resolved;
        break;
      }

      requiredAssets.push(resolved);
      break;
    }
  }

  return { childPlaylist, requiredAssets };
};

const probeHlsAsset = async (
  assetUrl: string,
  referer?: string,
): Promise<boolean> => {
  const response = await scrapeFetch(assetUrl, {
    method: "GET",
    headers: {
      Range: "bytes=0-1023",
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (!response.ok) {
    return false;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return isValidHlsAssetResponse(contentType, bytes);
};

export const isValidHlsAssetResponse = (
  contentType: string,
  bytes: Uint8Array,
): boolean => {
  const normalized = contentType.toLowerCase();
  const isTransportStream = bytes.length > 0 && bytes[0] === 0x47;
  const isIsoBmff =
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70;
  if (isTransportStream || isIsoBmff) return true;
  if (normalized.includes("text/html")) return false;

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isGif =
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38;
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  return !isPng && !isGif && !isJpeg;
};

const validateHlsPlayback = async (
  playlistUrl: string,
  body: string,
  referer?: string,
  depth = 0,
  expectedDurationMinutes?: number | null,
): Promise<boolean> => {
  if (!body.includes("#EXTM3U") || depth > 2) {
    return false;
  }

  const { childPlaylist, requiredAssets } = extractHlsProbeTargets(
    body,
    playlistUrl,
  );
  if (childPlaylist) {
    const response = await scrapeFetch(childPlaylist, {
      method: "GET",
      headers: referer ? { Referer: referer } : {},
    });
    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      return false;
    }

    const childBody = (await response.text()).slice(0, 64_000);
    const childValid = await validateHlsPlayback(
      childPlaylist,
      childBody,
      referer,
      depth + 1,
      expectedDurationMinutes,
    );
    if (!childValid) {
      return false;
    }

    if (expectedDurationMinutes) {
      const durationSeconds = parseStreamDurationSeconds(childBody, "hls");
      if (
        durationSeconds &&
        !streamDurationMatchesExpected(durationSeconds, expectedDurationMinutes)
      ) {
        return false;
      }
    }

    return true;
  }

  if (requiredAssets.length === 0) {
    return false;
  }

  for (const assetUrl of requiredAssets) {
    if (!(await probeHlsAsset(assetUrl, referer))) {
      return false;
    }
  }

  if (expectedDurationMinutes) {
    const durationSeconds = parseStreamDurationSeconds(body, "hls");
    if (
      durationSeconds &&
      !streamDurationMatchesExpected(durationSeconds, expectedDurationMinutes)
    ) {
      return false;
    }
  }

  return true;
};

export async function validateStreamUrl(
  streamUrl: string,
  referer?: string,
  kind: StreamKind = "hls",
  expectedDurationMinutes?: number | null,
): Promise<boolean> {
  if (!looksLikeStreamUrl(streamUrl, kind)) {
    return false;
  }

  try {
    const response = await scrapeFetch(streamUrl, {
      method: "GET",
      headers: {
        ...(referer ? { Referer: referer } : {}),
        ...(kind === "mp4" ? { Range: "bytes=0-511" } : {}),
      },
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (okContentTypesForKind(contentType, kind)) {
        const body = (await response.text()).slice(0, 64_000);
        if (!looksLikeValidBody(body, kind)) {
          return false;
        }

        if (expectedDurationMinutes && (kind === "dash" || kind === "hls")) {
          const durationSeconds = parseStreamDurationSeconds(body, kind);
          if (
            durationSeconds &&
            !streamDurationMatchesExpected(
              durationSeconds,
              expectedDurationMinutes,
            )
          ) {
            return false;
          }
        }

        return kind === "hls"
          ? validateHlsPlayback(
              streamUrl,
              body,
              referer,
              0,
              expectedDurationMinutes,
            )
          : true;
      }

      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** @deprecated Use validateStreamUrl with an explicit stream kind. */
export const validateAnimeStreamUrl = validateStreamUrl;
