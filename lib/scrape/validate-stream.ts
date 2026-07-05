import { scrapeFetch } from "./fetch";
import { looksLikeStreamUrl, type StreamKind } from "./stream-url-patterns";

const isBlockedChallengePage = (body: string): boolean =>
  /DDoS-Guard|ddos-guard/i.test(body);

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
  if (kind === "hls") {
    return (
      contentType.includes("mpegurl") ||
      contentType.includes("json") ||
      contentType.includes("text")
    );
  }

  return (
    contentType.includes("mpegurl") ||
    contentType.includes("dash") ||
    contentType.includes("mp4") ||
    contentType.includes("json") ||
    contentType.includes("text") ||
    contentType.includes("octet-stream")
  );
};

export async function validateStreamUrl(
  streamUrl: string,
  referer?: string,
  kind: StreamKind = "hls",
): Promise<boolean> {
  if (!looksLikeStreamUrl(streamUrl, kind)) {
    return false;
  }

  try {
    const response = await scrapeFetch(streamUrl, {
      method: "GET",
      headers: referer ? { Referer: referer } : {},
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (okContentTypesForKind(contentType, kind)) {
        const body = (await response.text()).slice(0, 512);
        return looksLikeValidBody(body, kind);
      }

      return true;
    }

    if (response.status === 403 || response.status === 405) {
      const body = (await response.text()).slice(0, 512);
      if (looksLikeValidBody(body, kind)) {
        return true;
      }

      if (kind === "hls" && isBlockedChallengePage(body)) {
        return false;
      }

      return looksLikeStreamUrl(streamUrl, kind);
    }

    return false;
  } catch {
    return looksLikeStreamUrl(streamUrl, kind);
  }
}

/** @deprecated Use validateStreamUrl with an explicit stream kind. */
export const validateAnimeStreamUrl = validateStreamUrl;
