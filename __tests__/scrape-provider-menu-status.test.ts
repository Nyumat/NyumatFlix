import { describe, expect, it } from "vitest";

import {
  resolveScrapeMenuDotVariant,
  shouldDimScrapeMenuProvider,
} from "@/lib/scrape/scrape-provider-menu-status";

describe("resolveScrapeMenuDotVariant", () => {
  it("shows success for working providers", () => {
    expect(
      resolveScrapeMenuDotVariant({
        liveStatus: "success",
        isActive: false,
        scrapeStatus: "playing",
      }),
    ).toBe("success");

    expect(
      resolveScrapeMenuDotVariant({
        liveStatus: "success",
        isActive: false,
        scrapeStatus: "idle",
      }),
    ).toBe("success");
  });

  it("shows untested for skipped, waiting, and idle providers", () => {
    for (const liveStatus of ["skipped", "waiting", "idle"] as const) {
      expect(
        resolveScrapeMenuDotVariant({
          liveStatus,
          isActive: false,
          scrapeStatus: "error",
        }),
      ).toBe("untested");
    }
  });

  it("shows failed only for confirmed failures", () => {
    expect(
      resolveScrapeMenuDotVariant({
        liveStatus: "failure",
        isActive: false,
        scrapeStatus: "error",
      }),
    ).toBe("failed");
  });

  it("shows probing while a provider is being checked", () => {
    expect(
      resolveScrapeMenuDotVariant({
        liveStatus: "pending",
        isActive: true,
        scrapeStatus: "scraping",
      }),
    ).toBe("probing");
  });
});

describe("shouldDimScrapeMenuProvider", () => {
  it("dims only confirmed live failures", () => {
    expect(shouldDimScrapeMenuProvider("skipped")).toBe(false);
    expect(shouldDimScrapeMenuProvider("failure")).toBe(true);
  });
});
