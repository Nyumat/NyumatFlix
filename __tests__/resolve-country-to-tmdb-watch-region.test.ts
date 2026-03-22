import { describe, expect, it } from "vitest";
import {
  readGeoCountryCodeFromHeaders,
  resolveCountryCodeToTmdbWatchRegion,
} from "@/lib/resolve-country-to-tmdb-watch-region";

describe("resolveCountryCodeToTmdbWatchRegion", () => {
  it("returns the same code when TMDB supports it", () => {
    expect(resolveCountryCodeToTmdbWatchRegion("de")).toBe("DE");
    expect(resolveCountryCodeToTmdbWatchRegion("GB")).toBe("GB");
    expect(resolveCountryCodeToTmdbWatchRegion("us")).toBe("US");
  });

  it("maps China to Hong Kong", () => {
    expect(resolveCountryCodeToTmdbWatchRegion("CN")).toBe("HK");
  });

  it("maps unknown IP placeholders to US", () => {
    expect(resolveCountryCodeToTmdbWatchRegion("XX")).toBe("US");
    expect(resolveCountryCodeToTmdbWatchRegion("ZZ")).toBe("US");
  });

  it("maps a non-TMDB country via continent fallback", () => {
    expect(resolveCountryCodeToTmdbWatchRegion("AQ")).toBe("US");
  });
});

describe("readGeoCountryCodeFromHeaders", () => {
  it("reads Vercel geo header first", () => {
    const h = new Headers();
    h.set("x-vercel-ip-country", "DE");
    expect(readGeoCountryCodeFromHeaders(h)).toBe("DE");
  });

  it("falls back to Cloudflare", () => {
    const h = new Headers();
    h.set("cf-ipcountry", "FR");
    expect(readGeoCountryCodeFromHeaders(h)).toBe("FR");
  });
});
