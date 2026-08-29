import type { ScrapeItemStatus } from "@/lib/scrape/types";

export type ScrapeMenuDotVariant =
  | "success"
  | "probing"
  | "untested"
  | "failed";

/** Map live scrape session state to a simple menu indicator. */
export function resolveScrapeMenuDotVariant({
  liveStatus,
  isActive,
  scrapeStatus,
}: {
  liveStatus: ScrapeItemStatus | "idle";
  isActive: boolean;
  scrapeStatus: "idle" | "scraping" | "playing" | "error";
}): ScrapeMenuDotVariant {
  if (liveStatus === "pending") {
    return "probing";
  }

  if (liveStatus === "success" || (scrapeStatus === "playing" && isActive)) {
    return "success";
  }

  if (liveStatus === "failure" || liveStatus === "unavailable") {
    return "failed";
  }

  return "untested";
}

export function shouldDimScrapeMenuProvider(
  liveStatus: ScrapeItemStatus | "idle",
): boolean {
  return liveStatus === "failure" || liveStatus === "unavailable";
}
