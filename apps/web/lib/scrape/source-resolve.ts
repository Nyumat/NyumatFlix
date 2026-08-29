import { looksLikeHlsStreamUrl } from "./stream-url-patterns";

const encodeLooseUrl = (url: string): string => {
  try {
    const parsed = new URL(url.replace(/ /g, "%20"));
    return parsed.toString();
  } catch {
    return url.replace(/ /g, "%20");
  }
};

const isProxyHost = (hostname: string, pathname: string): boolean =>
  /proxy/i.test(pathname) ||
  /wormhole\.filmu\.in$/i.test(hostname) ||
  /\.workers\.dev$/i.test(hostname);

/** Peel proxy/workers `?url=` wrappers down to the playable origin. */
export const unwrapProxyUrl = (url: string, maxDepth = 6): string => {
  let current = url;

  for (let depth = 0; depth < maxDepth; depth++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      break;
    }

    const nested = parsed.searchParams.get("url");
    if (!nested) {
      break;
    }

    if (!isProxyHost(parsed.hostname, parsed.pathname)) {
      break;
    }

    current = nested;
  }

  return encodeLooseUrl(current);
};

export type RankableSource = {
  url?: string;
  type?: string;
};

export const isHlsSourceUrl = (
  source: RankableSource,
  url: string,
): boolean => {
  const declared = source.type?.toLowerCase() ?? "";
  return (
    declared.includes("mpegurl") ||
    declared.includes("hls") ||
    looksLikeHlsStreamUrl(url) ||
    /\.m3u8(?:[?#]|$)/i.test(url) ||
    /\/pl\//i.test(url) ||
    /\/playlist\//i.test(url)
  );
};

/** Prefer HLS masters over flat/proxied MP4 when multiple sources exist. */
export const rankSourcesHlsFirst = <T extends RankableSource>(
  sources: readonly T[],
  resolveUrl: (source: T) => string | null = (source) => source.url ?? null,
): T[] =>
  [...sources].sort((left, right) => {
    const leftUrl = resolveUrl(left);
    const rightUrl = resolveUrl(right);
    const leftHls = leftUrl ? isHlsSourceUrl(left, leftUrl) : false;
    const rightHls = rightUrl ? isHlsSourceUrl(right, rightUrl) : false;
    return Number(rightHls) - Number(leftHls);
  });

/** Try ranked sources until a caller-supplied probe accepts one. */
export const trySourcesUntil = async <T>(
  sources: readonly T[],
  probe: (source: T) => Promise<{ ok: true; value: T } | { ok: false }>,
): Promise<T | null> => {
  for (const source of sources) {
    const result = await probe(source);
    if (result.ok) {
      return result.value;
    }
  }
  return null;
};
