import { describe, expect, it } from "vitest";

import {
  scrapeDirectDispatcher,
  scrapeProxyDispatcher,
} from "@/lib/scrape/proxy";

describe("scrape dispatchers", () => {
  it("reuses one direct dispatcher for the lifetime of the process", () => {
    expect(scrapeDirectDispatcher()).toBe(scrapeDirectDispatcher());
  });

  it("does not create a proxy dispatcher without a proxy URL", () => {
    expect(scrapeProxyDispatcher()).toBeUndefined();
  });
});
