import { describe, expect, it } from "vitest";

import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  announcementBannerConfigToJsx,
  parseAnnouncementBannerJsx,
} from "@/lib/flags/announcement-banner-jsx";

describe("announcement banner JSX", () => {
  it("round-trips every banner prop", () => {
    const config: AnnouncementBannerConfig = {
      ...DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
      id: "release-42",
      title: "New release",
      message: "The player is faster now.",
      icon: "Sparkles",
      backgroundColor: "#172554",
      textColor: "#dbeafe",
      accentColor: "#fbbf24",
      linkLabel: "See changes",
      linkUrl: "/updates",
      dismissible: false,
    };

    expect(
      parseAnnouncementBannerJsx(announcementBannerConfigToJsx(config)),
    ).toEqual({
      config,
      error: null,
    });
  });

  it("rejects arbitrary JSX and unknown props", () => {
    expect(
      parseAnnouncementBannerJsx("<script>alert(1)</script>").error,
    ).toMatch(/self-closing/i);
    expect(
      parseAnnouncementBannerJsx(
        '<AnnouncementBanner title="Safe" onClick="alert(1)" />',
      ).error,
    ).toBe("Unknown prop: onClick");
  });

  it("rejects invalid values instead of silently changing them", () => {
    expect(
      parseAnnouncementBannerJsx(
        '<AnnouncementBanner backgroundColor="red" dismissible={true} />',
      ).error,
    ).toBe("Invalid value for backgroundColor");
  });
});
