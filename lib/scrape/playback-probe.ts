import { cancelResponseBody } from "./fetch";
import { fetchScrapePlaybackUpstream } from "./playback-fetch";
import {
  type ScrapePlaybackToken,
  isDisguisedHlsSegment,
  isPlaylistResponse,
  resolveKaaSegmentFallbackUrls,
} from "./playback";
import { looksLikeHlsStreamUrl, type StreamKind } from "./stream-url-patterns";
import {
  extractHlsProbeTargets,
  isValidHlsAssetResponse,
} from "./validate-stream";
import { normalizeVidKingAssetHost } from "./vidking-cdn-url";

const looksLikeHlsPlaylistBody = (body: string): boolean =>
  body.includes("#EXTM3U");

const looksLikeDashManifestBody = (body: string): boolean =>
  body.includes("<MPD") || /\bmpd\b/i.test(body);

const shouldTreatAsHlsPlaylist = (
  targetUrl: string,
  contentType: string | null,
  body: string,
): boolean => {
  if (!looksLikeHlsPlaylistBody(body) || isDisguisedHlsSegment(targetUrl)) {
    return false;
  }

  return (
    isPlaylistResponse(targetUrl, contentType) ||
    looksLikeHlsStreamUrl(targetUrl) ||
    /mpegurl|m3u8|text\/|json|octet-stream|binary/i.test(contentType ?? "")
  );
};

const fetchWithKaaFallback = async (
  upstreamUrl: string,
  referer: string | undefined,
  cookies: string | undefined,
  rangeHeader: string | null,
): Promise<{ response: Response; url: string }> => {
  let response = await fetchScrapePlaybackUpstream(upstreamUrl, referer, {
    rangeHeader,
    cookies,
  });
  let url = upstreamUrl;

  if (response.status === 403) {
    for (const fallbackUrl of resolveKaaSegmentFallbackUrls(upstreamUrl)) {
      await cancelResponseBody(response);
      response = await fetchScrapePlaybackUpstream(fallbackUrl, referer, {
        rangeHeader,
        cookies,
      });
      url = fallbackUrl;
      if (response.ok || response.status !== 403) {
        break;
      }
    }
  }

  return { response, url };
};

const probeHlsAssetThroughPlaybackPath = async (
  assetUrl: string,
  referer: string | undefined,
  cookies: string | undefined,
): Promise<boolean> => {
  const candidates = [assetUrl, ...resolveKaaSegmentFallbackUrls(assetUrl)];

  for (const candidate of candidates) {
    const { response } = await fetchWithKaaFallback(
      candidate,
      referer,
      cookies,
      "bytes=0-1023",
    );
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

const probeHlsThroughPlaybackPath = async (
  playlistUrl: string,
  body: string,
  referer: string | undefined,
  cookies: string | undefined,
  depth = 0,
): Promise<boolean> => {
  if (!looksLikeHlsPlaylistBody(body) || depth > 2) {
    return false;
  }

  const { childPlaylist, requiredAssets } = extractHlsProbeTargets(
    body,
    playlistUrl,
  );

  if (childPlaylist) {
    const { response, url } = await fetchWithKaaFallback(
      childPlaylist,
      referer,
      cookies,
      null,
    );
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
    return probeHlsThroughPlaybackPath(
      url,
      childBody,
      referer,
      cookies,
      depth + 1,
    );
  }

  if (requiredAssets.length === 0) {
    return false;
  }

  for (const assetUrl of requiredAssets) {
    const normalized = normalizeVidKingAssetHost(assetUrl, playlistUrl);
    if (
      !(await probeHlsAssetThroughPlaybackPath(normalized, referer, cookies))
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Prove the stream works under the same egress policy as `/api/scrape/play`
 * (headers + curl fallback + KAA host rotation), including one media segment
 * for HLS. Call this before returning scrape `ok`.
 */
export async function probeScrapePlaybackPath(
  payload: ScrapePlaybackToken,
  kind: StreamKind = "hls",
): Promise<boolean> {
  try {
    const rangeHeader = kind === "mp4" ? "bytes=0-511" : null;
    const { response, url } = await fetchWithKaaFallback(
      payload.url,
      payload.referer,
      payload.cookies,
      rangeHeader,
    );

    if (!response.ok) {
      await cancelResponseBody(response);
      return false;
    }

    if (kind === "mp4") {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) {
        return false;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        return false;
      }
      return true;
    }

    const contentType = response.headers.get("content-type");
    const body = (await response.text()).slice(0, 64_000);

    if (kind === "dash") {
      return looksLikeDashManifestBody(body);
    }

    if (!shouldTreatAsHlsPlaylist(url, contentType, body)) {
      return false;
    }

    return probeHlsThroughPlaybackPath(
      url,
      body,
      payload.referer,
      payload.cookies,
    );
  } catch {
    return false;
  }
}

export { looksLikeHlsPlaylistBody, shouldTreatAsHlsPlaylist };
