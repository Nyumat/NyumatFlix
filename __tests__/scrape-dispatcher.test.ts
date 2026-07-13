import { describe, expect, it } from "vitest";

import {
  isVidsrcScrapeHostname,
  resetScrapeHostEgressPreferences,
  scrapeBypassesProxyHostname,
  scrapePreferDirectEgress,
  scrapePreferProxyHostname,
} from "@/lib/scrape/fetch";
import { scrapeDirectDispatcher, scrapeProxyUrl } from "@/lib/scrape/proxy";

describe("scrape dispatchers", () => {
  it("reuses one direct dispatcher for the lifetime of the process", () => {
    expect(scrapeDirectDispatcher()).toBe(scrapeDirectDispatcher());
  });

  it("does not create a proxy dispatcher without a proxy URL", () => {
    const previous = process.env.SCRAPE_PROXY_URL;
    delete process.env.SCRAPE_PROXY_URL;
    // Preference cache is unrelated; clear so leftover state doesn't confuse later tests.
    resetScrapeHostEgressPreferences();
    expect(scrapeProxyUrl()).toBeUndefined();
    if (previous === undefined) {
      delete process.env.SCRAPE_PROXY_URL;
    } else {
      process.env.SCRAPE_PROXY_URL = previous;
    }
  });

  it("prefers direct egress by default (opt out with SCRAPE_PREFER_DIRECT=0)", () => {
    const previous = process.env.SCRAPE_PREFER_DIRECT;
    delete process.env.SCRAPE_PREFER_DIRECT;
    expect(scrapePreferDirectEgress()).toBe(true);
    process.env.SCRAPE_PREFER_DIRECT = "0";
    expect(scrapePreferDirectEgress()).toBe(false);
    if (previous === undefined) {
      delete process.env.SCRAPE_PREFER_DIRECT;
    } else {
      process.env.SCRAPE_PREFER_DIRECT = previous;
    }
    resetScrapeHostEgressPreferences();
  });

  it("prefers proxy for wingsdatabase.com", () => {
    expect(scrapePreferProxyHostname("api.wingsdatabase.com")).toBe(true);
    expect(scrapePreferProxyHostname("kaa.lt")).toBe(false);
  });

  it("routes VidSrc through VPN proxy in prod and direct egress locally", () => {
    const previousProxy = process.env.SCRAPE_PROXY_URL;
    delete process.env.SCRAPE_PROXY_URL;
    resetScrapeHostEgressPreferences();

    expect(isVidsrcScrapeHostname("vsembed.ru")).toBe(true);
    expect(isVidsrcScrapeHostname("kaleidoscopekernel.space")).toBe(true);
    expect(isVidsrcScrapeHostname("cloudorchestranova.com")).toBe(true);
    expect(scrapeBypassesProxyHostname("vsembed.ru")).toBe(true);
    expect(scrapePreferProxyHostname("vsembed.ru")).toBe(false);

    process.env.SCRAPE_PROXY_URL = "http://gluetun:8888";
    resetScrapeHostEgressPreferences();
    expect(scrapeBypassesProxyHostname("vsembed.ru")).toBe(false);
    expect(scrapeBypassesProxyHostname("kaleidoscopekernel.space")).toBe(false);
    expect(scrapePreferProxyHostname("vsembed.ru")).toBe(true);
    expect(scrapePreferProxyHostname("kaleidoscopekernel.space")).toBe(true);

    if (previousProxy === undefined) {
      delete process.env.SCRAPE_PROXY_URL;
    } else {
      process.env.SCRAPE_PROXY_URL = previousProxy;
    }
    resetScrapeHostEgressPreferences();
  });

  it("bypasses proxy for AniList metadata and anime CDN hosts", () => {
    expect(scrapeBypassesProxyHostname("graphql.anilist.co")).toBe(true);
    expect(scrapeBypassesProxyHostname("vivibebe.site")).toBe(true);
    expect(scrapeBypassesProxyHostname("cdn.mewstream.buzz")).toBe(true);
    expect(scrapeBypassesProxyHostname("momo.justanime.to")).toBe(true);
    expect(scrapeBypassesProxyHostname("momo.alright-rabbit.workers.dev")).toBe(
      true,
    );
    expect(
      scrapeBypassesProxyHostname("morning-credit.vibevibe.workers.dev"),
    ).toBe(true);
    expect(scrapeBypassesProxyHostname("api.kyren.moe")).toBe(true);
    expect(scrapeBypassesProxyHostname("stream.animeparadise.moe")).toBe(true);
    expect(scrapeBypassesProxyHostname("kaa.lt")).toBe(false);
  });
});
