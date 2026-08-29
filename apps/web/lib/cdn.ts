/**
 * Public asset CDN origin. Matches `assetPrefix` in next.config.mjs.
 * Set NEXT_PUBLIC_CDN_ORIGIN in production (e.g. https://cdn.nyumatflix.com).
 */
export function getCdnOrigin(): string {
  return (process.env.NEXT_PUBLIC_CDN_ORIGIN ?? "").replace(/\/$/, "");
}

/** Prefix a same-origin public path with the CDN origin in production. */
export function cdnUrl(path: string): string {
  if (!path.startsWith("/")) {
    return path;
  }
  const origin = getCdnOrigin();
  if (!origin) {
    return path;
  }
  return `${origin}${path}`;
}
