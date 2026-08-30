import { describe, expect, it } from "vitest";

import { isScrapeAborted } from "@/lib/scrape/abort";

describe("scrape abort helpers", () => {
  it("detects aborted signals", () => {
    const controller = new AbortController();
    expect(isScrapeAborted(controller.signal)).toBe(false);
    controller.abort();
    expect(isScrapeAborted(controller.signal)).toBe(true);
    expect(isScrapeAborted(undefined)).toBe(false);
  });
});
