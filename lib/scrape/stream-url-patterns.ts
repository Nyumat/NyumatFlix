export const looksLikeHlsStreamUrl = (url: string): boolean =>
  /\.m3u8(?:[?#].*|$)/i.test(url) ||
  /playlist\.json(?:[?#].*|$)/i.test(url) ||
  /cf-master[^/?#]+\.txt(?:[?#].*|$)/i.test(url) ||
  /\/master(?:[?#].*|$)/i.test(url) ||
  /goodstream\.cc\/(?:streamsvr|pl)\//i.test(url) ||
  /1x2\.space\/playlist\//i.test(url) ||
  /api\.kyren\.moe\/v1\/hls\//i.test(url) ||
  /stream\.animeparadise\.moe\/m3u8\?/i.test(url) ||
  /vixsrc\.to\/playlist\//i.test(url) ||
  /wormhole\.filmu\.in\/proxy\/m3u8/i.test(url) ||
  /\/pl\/[A-Za-z0-9._-]{20,}/i.test(url);

/** Tokenized masters often block child playlist probes from datacenter IPs. */
export const isTokenizedHlsMaster = (url: string): boolean =>
  /cf-master[^/?#]+\.txt(?:[?#].*|$)/i.test(url) ||
  /[?&][te]=/i.test(url) ||
  /goodstream\.cc\/pl\//i.test(url) ||
  /astroliteonline\.online\//i.test(url);

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
