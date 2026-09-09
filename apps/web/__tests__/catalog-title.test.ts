import { describe, expect, it } from "vitest";

import { scrapeCatalogTitle } from "@/lib/scrape/catalog-title";

describe("scrapeCatalogTitle", () => {
  it("appends year so remakes do not collide on title-only search", () => {
    expect(scrapeCatalogTitle("The Twilight Zone", "2019")).toBe(
      "The Twilight Zone (2019)",
    );
    expect(scrapeCatalogTitle("The Twilight Zone", 1959)).toBe(
      "The Twilight Zone (1959)",
    );
  });

  it("does not double-wrap a title that already has that year", () => {
    expect(scrapeCatalogTitle("The Twilight Zone (2019)", "2019")).toBe(
      "The Twilight Zone (2019)",
    );
  });

  it("leaves the title alone without a 4-digit year", () => {
    expect(scrapeCatalogTitle("The Twilight Zone")).toBe("The Twilight Zone");
    expect(scrapeCatalogTitle("The Twilight Zone", "")).toBe(
      "The Twilight Zone",
    );
    expect(scrapeCatalogTitle("The Twilight Zone", "unknown")).toBe(
      "The Twilight Zone",
    );
  });
});
