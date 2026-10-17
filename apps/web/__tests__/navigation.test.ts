import { describe, expect, it } from "vitest";

import { getFooterLinks, getNavigationItems } from "@/lib/navigation";

describe("site navigation helpers", () => {
  it("keeps browse grid cells even when Live TV is enabled", () => {
    const items = getNavigationItems(true);
    expect(items.length % 2).toBe(0);
    expect(items.some((item) => item.title === "Live TV")).toBe(true);
    expect(items.some((item) => item.title === "Manifesto")).toBe(true);
  });

  it("includes Manifesto in browse when Live TV is disabled", () => {
    const items = getNavigationItems(false);
    expect(items.some((item) => item.title === "Manifesto")).toBe(true);
    expect(items.some((item) => item.title === "Live TV")).toBe(false);
  });

  it("includes Live TV in footer links when the feature is enabled", () => {
    const links = getFooterLinks(true).map((link) => link.label);
    expect(links).toContain("Live TV");
    expect(links).toContain("Manifesto");
  });
});
