import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { encKaiToken } from "@/lib/scrape/anime/animekai-cipher";
import { encryptAnimeKai } from "@/lib/scrape/anime/animekai-cipher-core";

const fixturePath = resolve(__dirname, "fixtures", "kai-crypto.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  cases: Array<{ plain: string; token: string; matchesEncDec?: boolean }>;
};

describe("animekai-cipher", () => {
  it("encKaiToken matches golden enc-dec vectors", () => {
    for (const row of fixture.cases) {
      expect(encKaiToken(row.plain)).toBe(row.token);
    }
  });

  it("encKaiToken rejects empty input", () => {
    expect(() => encKaiToken("  ")).toThrow(/empty plaintext/);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports match core encryptAnimeKai", () => {
    expect(encKaiToken("abc")).toBe(encryptAnimeKai("abc"));
  });
});
