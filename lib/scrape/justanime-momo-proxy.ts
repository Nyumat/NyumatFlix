import "server-only";

export const JUSTANIME_ORIGIN = "https://justanime.to";

/** Primary momo proxy — justanime.to mirrors the workers.dev pool. */
export const JUSTANIME_MOMO_PROXY_BASE = "https://momo.justanime.to/proxy?url=";

const MOMO_PROXY_PATTERN =
  /\/\/momo(?:\.[a-z0-9-]+)?\.(?:justanime\.to|workers\.dev)\/proxy\?url=/i;

export const isJustanimeMomoProxyUrl = (url: string): boolean =>
  MOMO_PROXY_PATTERN.test(url);

export const wrapJustanimeMomoProxyUrl = (
  targetUrl: string,
  base = JUSTANIME_MOMO_PROXY_BASE,
): string => `${base}${encodeURIComponent(targetUrl)}`;

export const unwrapJustanimeMomoProxyUrl = (url: string): string | null => {
  if (!isJustanimeMomoProxyUrl(url)) {
    return null;
  }

  try {
    const inner = new URL(url).searchParams.get("url")?.trim();
    if (!inner || !/^https?:\/\//i.test(inner)) {
      return null;
    }
    return inner;
  } catch {
    return null;
  }
};

/** Megaplay HLS from JustAnime — segment hosts block direct server egress. */
export const shouldWrapJustanimeMegaplayStream = (streamUrl: string): boolean =>
  /mewstream/i.test(streamUrl);

export const wrapJustanimeMegaplayStreamUrl = (streamUrl: string): string => {
  if (
    isJustanimeMomoProxyUrl(streamUrl) ||
    !shouldWrapJustanimeMegaplayStream(streamUrl)
  ) {
    return streamUrl;
  }

  return wrapJustanimeMomoProxyUrl(streamUrl);
};

export const refererForJustanimeStreamUrl = (
  streamUrl: string,
  headersReferer?: string,
  fallbackReferer?: string,
): string => {
  if (isJustanimeMomoProxyUrl(streamUrl)) {
    return `${JUSTANIME_ORIGIN}/`;
  }

  return headersReferer ?? fallbackReferer ?? streamUrl;
};
