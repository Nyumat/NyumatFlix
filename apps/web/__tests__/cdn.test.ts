import { cdnUrl } from "@/lib/cdn";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("cdnUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the path unchanged when no CDN origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "");
    expect(cdnUrl("/movie-banner.webp")).toBe("/movie-banner.webp");
  });

  it("prefixes same-origin paths with the CDN origin", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "https://cdn.nyumatflix.com");
    expect(cdnUrl("/movie-banner.webp")).toBe(
      "https://cdn.nyumatflix.com/movie-banner.webp",
    );
  });

  it("leaves absolute and remote URLs unchanged", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "https://cdn.nyumatflix.com");
    expect(cdnUrl("https://image.tmdb.org/t/p/w500/poster.jpg")).toBe(
      "https://image.tmdb.org/t/p/w500/poster.jpg",
    );
  });

  it("strips a trailing slash from the CDN origin", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "https://cdn.nyumatflix.com/");
    expect(cdnUrl("/icon.png")).toBe("https://cdn.nyumatflix.com/icon.png");
  });
});
