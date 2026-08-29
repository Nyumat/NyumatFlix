import { pickEnglishLogo } from "@/lib/tmdb-logo";
import { describe, expect, it } from "vitest";

const baseLogo = {
  file_path: "/logo.png",
  aspect_ratio: 2,
  height: 100,
  width: 200,
  vote_average: 5,
  vote_count: 10,
};

describe("pickEnglishLogo", () => {
  it("prefers english logos", () => {
    const logo = pickEnglishLogo([
      { ...baseLogo, iso_639_1: "ja" },
      { ...baseLogo, iso_639_1: "en", file_path: "/en.png" },
    ]);

    expect(logo?.file_path).toBe("/en.png");
  });

  it("falls back to the first logo", () => {
    const logo = pickEnglishLogo([{ ...baseLogo, iso_639_1: "ja" }]);

    expect(logo?.file_path).toBe("/logo.png");
  });

  it("accepts null language codes", () => {
    const logo = pickEnglishLogo([{ ...baseLogo, iso_639_1: null }]);

    expect(logo?.file_path).toBe("/logo.png");
  });
});
