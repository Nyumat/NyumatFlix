import { cancelResponseBody, scrapeFetch } from "./fetch";
import { resolveHlsPlaylistUrl } from "./hls-url";
import { resolveKaaSegmentFallbackUrls } from "./playback";
import {
  parseStreamDurationSeconds,
  streamDurationMatchesExpected,
} from "./stream-duration";
import { looksLikeStreamUrl, type StreamKind } from "./stream-url-patterns";
import { scrapeUpstreamHeaders } from "./upstream-headers";
import { normalizeVidKingAssetHost } from "./vidking-cdn-url";

export type ValidateStreamDepth = "full" | "master";

export type ValidateStreamOptions = {
  depth?: ValidateStreamDepth;
  expectedDurationMinutes?: number | null;
};

/**
 * Default accept depth is full (segment/key probes). Pass `depth: "master"`
 * only for cheap candidate filters inside a provider — never as the final gate.
 */
export const resolveValidateStreamDepths = (
  depth?: ValidateStreamDepth,
): readonly ValidateStreamDepth[] => {
  if (depth === "master") return ["master"];
  if (depth === "full") return ["full"];
  return ["full"];
};

/** Ordered referers to try — embed/player first (needed for segments), then CDN. */
export const resolveStreamReferers = (
  streamUrl: string,
  embedReferer: string,
): string[] => {
  const referers: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | undefined) => {
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    referers.push(value);
  };

  push(embedReferer);

  try {
    push(new URL(streamUrl).origin + "/");
  } catch {
    void 0;
  }

  return referers;
};

const isValidHlsMasterBody = (body: string): boolean =>
  body.includes("#EXTM3U") &&
  (body.includes("#EXT-X-STREAM-INF") ||
    body.includes("#EXTINF:") ||
    body.includes("#EXT-X-MAP") ||
    body.includes("#EXT-X-TARGETDURATION"));

/**
 * Default: full segment probes. Pass `depth: "master"` for candidate filters
 * where full would multiply cost — final accept must still use full / play-path.
 */
export async function validateStreamUrlWithReferers(
  streamUrl: string,
  embedReferer: string,
  kind: StreamKind = "hls",
  options: ValidateStreamOptions = {},
): Promise<{ ok: boolean; referer?: string }> {
  const depths: ValidateStreamDepth[] = [
    ...resolveValidateStreamDepths(options.depth),
  ];

  for (const depth of depths) {
    for (const referer of resolveStreamReferers(streamUrl, embedReferer)) {
      if (
        await validateStreamUrl(
          streamUrl,
          referer,
          kind,
          options.expectedDurationMinutes,
          depth,
        )
      ) {
        return { ok: true, referer };
      }
    }
  }

  return { ok: false };
}

const looksLikeValidBody = (body: string, kind: StreamKind): boolean => {
  if (kind === "hls") {
    // Require a real playlist marker — rewritten HTML 404s can contain "m3u8"
    // path fragments while still being unplayable.
    return (
      body.includes("#EXTM3U") ||
      body.includes('"playlist"') ||
      body.includes("cf-master")
    );
  }

  if (kind === "dash") {
    return body.includes("<MPD") || body.includes("mpd");
  }

  return body.includes("ftyp") || (body.length > 0 && !body.includes("<html"));
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
      const resolved = resolveHlsPlaylistUrl(value, playlistUrl);
      if (resolved && !requiredAssets.includes(resolved)) {
        requiredAssets.push(resolved);
      }
    }
  }

  let childPlaylist: string | null = null;
  for (const line of lines) {
    if (line && !line.startsWith("#")) {
      const resolved = resolveHlsPlaylistUrl(line, playlistUrl);
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
  const candidates = [assetUrl, ...resolveKaaSegmentFallbackUrls(assetUrl)];

  for (const candidate of candidates) {
    const response = await scrapeFetch(candidate, {
      method: "GET",
      headers: {
        Range: "bytes=0-1023",
        ...scrapeUpstreamHeaders(candidate, referer),
      },
    });
    if (!response.ok) {
      await cancelResponseBody(response);
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (isValidHlsAssetResponse(contentType, bytes)) {
      return true;
    }
  }

  return false;
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
      headers: scrapeUpstreamHeaders(childPlaylist, referer),
    });
    if (!response.ok) {
      await cancelResponseBody(response);
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      await cancelResponseBody(response);
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
    const normalizedAssetUrl = normalizeVidKingAssetHost(assetUrl, playlistUrl);
    if (!(await probeHlsAsset(normalizedAssetUrl, referer))) {
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
  depth: ValidateStreamDepth = "full",
): Promise<boolean> {
  if (!looksLikeStreamUrl(streamUrl, kind)) {
    return false;
  }

  try {
    const response = await scrapeFetch(streamUrl, {
      method: "GET",
      headers: {
        ...scrapeUpstreamHeaders(streamUrl, referer),
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

        if (kind !== "hls") {
          return true;
        }

        if (depth === "master" && isValidHlsMasterBody(body)) {
          return true;
        }

        return validateHlsPlayback(
          streamUrl,
          body,
          referer,
          0,
          expectedDurationMinutes,
        );
      }

      await cancelResponseBody(response);
      return false;
    }

    await cancelResponseBody(response);
    return false;
  } catch {
    return false;
  }
}

/** @deprecated Use validateStreamUrl with an explicit stream kind. */
export const validateAnimeStreamUrl = validateStreamUrl;
