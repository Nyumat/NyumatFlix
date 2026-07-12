import { beforeEach, describe, expect, it } from "vitest";

import {
  clearPreferredScrapeProvider,
  getPreferredScrapeProvider,
  setPreferredScrapeProvider,
} from "@/lib/scrape/preferred-provider";

describe("preferred-provider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getPreferredScrapeProvider("198511:1:sub")).toBeNull();
  });

  it("stores and reads a preferred provider", () => {
    setPreferredScrapeProvider("198511:1:sub", "hentaigasm");
    expect(getPreferredScrapeProvider("198511:1:sub")).toBe("hentaigasm");
  });

  it("clears a preferred provider", () => {
    setPreferredScrapeProvider("198511:1:sub", "hentaigasm");
    clearPreferredScrapeProvider("198511:1:sub");
    expect(getPreferredScrapeProvider("198511:1:sub")).toBeNull();
  });

  it("ignores empty keys", () => {
    setPreferredScrapeProvider("", "hentaigasm");
    setPreferredScrapeProvider("198511:1:sub", "");
    expect(getPreferredScrapeProvider("198511:1:sub")).toBeNull();
  });

  it("does not persist unreliable fast scrapers such as vixsrc", () => {
    setPreferredScrapeProvider("movie:550", "vixsrc");
    expect(getPreferredScrapeProvider("movie:550")).toBeNull();
  });
});
