import { createCipheriv, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { scrapeBingr, unwrapBingrProxyUrl } from "@/lib/scrape/providers/bingr";
import {
  decryptVidrockUrl,
  scrapeVidrock,
} from "@/lib/scrape/providers/vidrock";
import { scrapeVixsrc } from "@/lib/scrape/providers/vixsrc";
import { scrapeProvider } from "@/lib/scrape";

const VIDROCK_AES_KEY = Buffer.from(
  "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f",
  "hex",
);

const encryptVidrockUrl = (plaintext: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", VIDROCK_AES_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64url");
};

describe("vidrock decrypt", () => {
  it("round-trips AES-GCM URLs", () => {
    const url = "https://example.com/master.m3u8";
    expect(decryptVidrockUrl(encryptVidrockUrl(url))).toBe(url);
  });
});

describe("bingr proxy unwrap", () => {
  it("peels nested wormhole url params", () => {
    const upstream =
      "https://remoteconsultinggroup.site/abc/pl/H4sIAAAAAAAAAwXB0XaCIBgA4FcCtY7urlraMHAi";
    const nested = `https://wormhole.filmu.in/proxy/m3u8?url=${encodeURIComponent(upstream)}&referer=https%3A%2F%2Fnextgencloudfabric.com%2F`;
    const proxied = `https://wormhole.filmu.in/proxy/m3u8?url=${encodeURIComponent(nested)}`;
    expect(unwrapBingrProxyUrl(proxied)).toBe(upstream);
  });
});

const runLive = process.env.LIVE_SCRAPE === "1";

describe.skipIf(!runLive)("new tmdb providers (live)", () => {
  it("VixSrc scrapes Fight Club", async () => {
    const result = await scrapeVixsrc({ mediaType: "movie", tmdbId: 550 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.streamUrl).toMatch(/vixsrc\.to\/playlist\//);
    expect(result.streamUrl).toMatch(/[?&]h=1(?:&|$)/);
  }, 45_000);

  it("VidRock scrapes Fight Club", async () => {
    const result = await scrapeVidrock({ mediaType: "movie", tmdbId: 550 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.streamUrl).toMatch(/\.m3u8(?:[?#]|$)/i);
  }, 60_000);

  it("full scrapeProvider validates VixSrc", async () => {
    const result = await scrapeProvider("vixsrc", {
      mediaType: "movie",
      tmdbId: 550,
    });
    expect(result.ok).toBe(true);
  }, 60_000);

  it("full scrapeProvider validates VidRock", async () => {
    const result = await scrapeProvider("vidrock", {
      mediaType: "movie",
      tmdbId: 550,
    });
    expect(result.ok).toBe(true);
  }, 90_000);

  it("Bingr scrapes Fight Club", async () => {
    const result = await scrapeBingr({ mediaType: "movie", tmdbId: 550 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.streamUrl.length).toBeGreaterThan(20);
  }, 60_000);

  it("full scrapeProvider validates Bingr", async () => {
    const result = await scrapeProvider("bingr", {
      mediaType: "movie",
      tmdbId: 550,
    });
    expect(result.ok).toBe(true);
  }, 90_000);
});
