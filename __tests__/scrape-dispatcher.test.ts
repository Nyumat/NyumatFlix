import { describe, expect, it } from "vitest";

import { scrapeDirectDispatcher, scrapeProxyUrl } from "@/lib/scrape/proxy";
import {
  resetScrapeHostEgressPreferences,
  scrapePreferDirectEgress,
} from "@/lib/scrape/fetch";

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
});
