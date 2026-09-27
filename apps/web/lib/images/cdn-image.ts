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

export type CdnImageOptions = {
  width?: number;
  height?: number;
  format?: CdnImageFormat;
};

export const POSTER_IMAGE_WIDTHS = [185, 342, 500] as const;
export const BACKDROP_IMAGE_WIDTHS = [780, 1280] as const;
export const HERO_IMAGE_WIDTHS = [1280, 1920] as const;

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

const normalizeOptions = (
  options?: CdnImageOptions | CdnImageFormat,
): CdnImageOptions => {
  if (options === "avif" || options === "webp") {
    return { format: options };
  }
  return options ?? {};
};

const buildProcessingSegment = (options: CdnImageOptions) => {
  if (options.width && options.width > 0) {
    const height = options.height && options.height > 0 ? options.height : 0;
    return `rs:fit:${options.width}:${height}/plain`;
  }
  return "plain";
};

export const optimizeRemoteImageUrl = (
  remoteUrl: string,
  options?: CdnImageOptions | CdnImageFormat,
): string => {
  if (!remoteUrl.startsWith("http")) {
    return remoteUrl;
  }

  if (!isImageProxyEnabled() || !isAllowedRemoteUrl(remoteUrl)) {
    return remoteUrl;
  }

  const resolved = normalizeOptions(options);
  const encoded = encodeURIComponent(remoteUrl);
  const processing = buildProcessingSegment(resolved);
  const format = resolved.format ?? "avif";
  return `${getImageProxyBase()}/insecure/${processing}/${encoded}@${format}`;
};

export const buildCdnImageSrcSet = (
  remoteUrl: string,
  widths: readonly number[],
  options?: Omit<CdnImageOptions, "width" | "height">,
): string => {
  if (!remoteUrl.startsWith("http")) {
    return "";
  }

  if (!isImageProxyEnabled() || !isAllowedRemoteUrl(remoteUrl)) {
    return "";
  }

  const format = options?.format ?? "avif";
  return widths
    .map((width) => {
      const url = optimizeRemoteImageUrl(remoteUrl, {
        ...options,
        width,
        format,
      });
      return `${url} ${width}w`;
    })
    .join(", ");
};

export const posterSrcSet = (
  remoteUrl: string,
  format: CdnImageFormat = "avif",
) => buildCdnImageSrcSet(remoteUrl, POSTER_IMAGE_WIDTHS, { format });

export const backdropSrcSet = (
  remoteUrl: string,
  format: CdnImageFormat = "avif",
) => buildCdnImageSrcSet(remoteUrl, BACKDROP_IMAGE_WIDTHS, { format });

export const heroSrcSet = (
  remoteUrl: string,
  format: CdnImageFormat = "avif",
) => buildCdnImageSrcSet(remoteUrl, HERO_IMAGE_WIDTHS, { format });

export const optimizeSiteAssetImageUrl = (
  path: string,
  options?: CdnImageOptions | CdnImageFormat,
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

  return optimizeRemoteImageUrl(`${siteUrl}${path}`, options);
};
