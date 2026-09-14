import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  decryptHexaApiResponse,
  deriveHexaContentKey,
} from "@/lib/scrape/hexa-cipher";
import { resetHexaWasmSessionForTests } from "@/lib/scrape/hexa-wasm-session";

const fixturePath = resolve(__dirname, "fixtures", "hexa-movie-550.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  apiKey: string;
  encrypted: string;
  decrypted: { sources: Array<{ server: string; url: string }> };
};

describe("hexa-cipher", () => {
  afterAll(async () => {
    await resetHexaWasmSessionForTests();
  });

  it("deriveHexaContentKey returns 32 bytes from 64 hex chars", () => {
    const key = deriveHexaContentKey(fixture.apiKey);
    expect(key.length).toBe(32);
    expect(key.toString("hex")).toBe(fixture.apiKey.toLowerCase());
  });

  it("fixture ciphertext matches AES-GCM layout (12 + payload + 16)", () => {
    const raw = Buffer.from(fixture.encrypted, "base64");
    expect(raw.length).toBeGreaterThan(12 + 16 + 1);
  });

  it.runIf(process.env.HEXA_WASM_TESTS === "1")(
    "decryptHexaApiResponse matches fixture decrypted JSON",
    async () => {
      const payload = await decryptHexaApiResponse(
        fixture.encrypted,
        fixture.apiKey,
      );
      expect(payload.sources).toHaveLength(fixture.decrypted.sources.length);
      expect(payload.sources.map((s) => s.server)).toEqual(
        fixture.decrypted.sources.map((s) => s.server),
      );
      expect(payload.sources[0]?.url).toBe(fixture.decrypted.sources[0]?.url);
    },
    120_000,
  );
});
