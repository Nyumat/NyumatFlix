import { getCdnOrigin } from "@/lib/cdn";

const ALLOWED_REMOTE_PREFIXES = [
  "https://image.tmdb.org/",
  "https://s4.anilist.co/",
  "https://media.kitsu.app/",
  "https://img.youtube.com/",
] as const;

const getSiteOriginPrefix = () => {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL ??
    ""
  ).replace(/\/$/, "");

  return siteUrl ? `${siteUrl}/` : null;
};

const isAllowedRemoteUrl = (url: string) => {
  const sitePrefix = getSiteOriginPrefix();
  if (sitePrefix && url.startsWith(sitePrefix)) {
    return true;
  }

  return ALLOWED_REMOTE_PREFIXES.some((prefix) => url.startsWith(prefix));
};

export type CdnImageFormat = "avif" | "webp";

export const isImageProxyEnabled = () =>
  process.env.NEXT_PUBLIC_IMAGE_PROXY_ENABLED === "1" ||
  (process.env.NODE_ENV === "production" && Boolean(getCdnOrigin()));

const getImageProxyBase = () => {
  const cdnOrigin = getCdnOrigin();
  if (cdnOrigin) {
    return `${cdnOrigin}/img`;
  }
  return "/img";
};

export const optimizeRemoteImageUrl = (
  remoteUrl: string,
  format: CdnImageFormat = "avif",
): string => {
  if (!remoteUrl.startsWith("http")) {
    return remoteUrl;
  }

  if (!isImageProxyEnabled() || !isAllowedRemoteUrl(remoteUrl)) {
    return remoteUrl;
  }

  const encoded = encodeURIComponent(remoteUrl);
  return `${getImageProxyBase()}/insecure/plain/${encoded}@${format}`;
};

export const optimizeSiteAssetImageUrl = (
  path: string,
  format: CdnImageFormat = "avif",
): string => {
  if (!path.startsWith("/") || !isImageProxyEnabled()) {
    return path;
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL ??
    ""
  ).replace(/\/$/, "");

  if (!siteUrl) {
    return path;
  }

  return optimizeRemoteImageUrl(`${siteUrl}${path}`, format);
};
