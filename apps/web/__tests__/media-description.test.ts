import { describe, expect, it } from "vitest";
import { buildMediaDescription } from "@/lib/seo/media-description";

describe("buildMediaDescription", () => {
  it("prefers a concise tagline over overview", () => {
    const result = buildMediaDescription({
      tagline: "Mischief. Mayhem. Soap.",
      overview:
        "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.",
      fallback: "Watch Fight Club on NyumatFlix",
    });

    expect(result).toBe("Mischief. Mayhem. Soap.");
  });

  it("falls back to overview when tagline is too long", () => {
    const longTagline = "A".repeat(140);
    const overview = "Short overview for testing.";

    const result = buildMediaDescription({
      tagline: longTagline,
      overview,
      fallback: "Fallback",
    });

    expect(result).toBe(overview);
  });

  it("falls back to overview when tagline is too short", () => {
    const result = buildMediaDescription({
      tagline: "Go.",
      overview: "A longer but useful overview.",
      fallback: "Fallback",
    });

    expect(result).toBe("A longer but useful overview.");
  });

  it("uses overview when no tagline exists", () => {
    const result = buildMediaDescription({
      overview: "Seven noble families fight for control of Westeros.",
      fallback: "Watch Game of Thrones on NyumatFlix",
    });

    expect(result).toBe("Seven noble families fight for control of Westeros.");
  });
});
