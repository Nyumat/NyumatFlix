import { describe, expect, it } from "vitest";

import { vidstackCaptionMenuValue } from "@/lib/playback/vidstack-caption-menu";

describe("vidstack caption menu values", () => {
  it("matches Vidstack useCaptionOptions track value format", () => {
    expect(
      vidstackCaptionMenuValue({
        id: "scrape-en-1ex8uzm",
        kind: "subtitles",
        label: "en · AniZone",
      }),
    ).toBe("scrape-en-1ex8uzm:subtitles-en · anizone");
  });
});
