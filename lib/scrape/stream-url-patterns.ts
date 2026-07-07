/** URL shapes that resolve to HLS manifests (including extensionless VidNest CDNs). */
export const looksLikeHlsStreamUrl = (url: string): boolean =>
  /\.m3u8(?:[?#].*|$)/i.test(url) ||
  /playlist\.json(?:[?#].*|$)/i.test(url) ||
  /cf-master[^/?#]+\.txt(?:[?#].*|$)/i.test(url) ||
  /\/master(?:[?#].*|$)/i.test(url) ||
  /goodstream\.cc\/(?:streamsvr|pl)\//i.test(url);

export type StreamKind = "hls" | "dash" | "mp4";

export const looksLikeStreamUrl = (
  url: string,
  kind: StreamKind = "hls",
): boolean => {
  if (kind === "hls") {
    return looksLikeHlsStreamUrl(url);
  }

  if (kind === "dash") {
    return /\.mpd(?:[?#].*|$)/i.test(url);
  }

  if (kind === "mp4") {
    return (
      /\.mp4(?:[?#].*|$)/i.test(url) ||
      /\/api\/hen\/o8\/mp4(?:[?#].*|$)/i.test(url) ||
      /\/api\/anime\/src\/file(?:[?#].*|$)/i.test(url)
    );
  }

  return false;
};

export const refererForStreamUrl = (
  streamUrl: string,
  fallbackReferer: string,
): string => {
  try {
    return new URL(streamUrl).origin + "/";
  } catch {
    return fallbackReferer;
  }
};
