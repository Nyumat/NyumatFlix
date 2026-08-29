import {
  isImageProxyEnabled,
  optimizeRemoteImageUrl,
  optimizeSiteAssetImageUrl,
} from "@/lib/images/cdn-image";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("optimizeRemoteImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the original URL when the proxy is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "");
    vi.stubEnv("NEXT_PUBLIC_IMAGE_PROXY_ENABLED", "");
    vi.stubEnv("NODE_ENV", "development");

    const remote = "https://image.tmdb.org/t/p/w780/poster.jpg";
    expect(optimizeRemoteImageUrl(remote)).toBe(remote);
    expect(isImageProxyEnabled()).toBe(false);
  });

  it("rewrites allowed TMDB URLs through the CDN imgproxy path in production", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "https://cdn.nyumatflix.com");
    vi.stubEnv("NODE_ENV", "production");

    const remote = "https://image.tmdb.org/t/p/w1280/backdrop.jpg";
    expect(optimizeRemoteImageUrl(remote)).toBe(
      `https://cdn.nyumatflix.com/img/insecure/plain/${encodeURIComponent(remote)}@avif`,
    );
  });

  it("supports webp output when requested", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "https://cdn.nyumatflix.com");
    vi.stubEnv("NODE_ENV", "production");

    const remote = "https://s4.anilist.co/file/anilist/characters/1.jpg";
    expect(optimizeRemoteImageUrl(remote, "webp")).toContain("@webp");
  });

  it("leaves disallowed remote hosts untouched", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "https://cdn.nyumatflix.com");
    vi.stubEnv("NODE_ENV", "production");

    const remote = "https://example.com/poster.jpg";
    expect(optimizeRemoteImageUrl(remote)).toBe(remote);
  });

  it("can proxy same-origin public assets when site URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "https://cdn.nyumatflix.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://nyumatflix.com");
    vi.stubEnv("NODE_ENV", "production");

    expect(optimizeSiteAssetImageUrl("/movie-banner.webp")).toBe(
      `https://cdn.nyumatflix.com/img/insecure/plain/${encodeURIComponent("https://nyumatflix.com/movie-banner.webp")}@avif`,
    );
  });
});
