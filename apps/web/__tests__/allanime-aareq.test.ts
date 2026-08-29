import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  ALLANIME_BOOT_PREFIX,
  ALLANIME_EPISODE_LANE,
  ALLANIME_EPISODE_QUERY_FALLBACK,
  ALLANIME_EPISODE_QUERY_HASH_FALLBACK,
  ALLANIME_FALLBACK_MASK_PARTS,
  buildAllanimeBootToken,
  deriveAllanimeAaReqKey,
  deriveAllanimeMaskKey,
  extractAllanimeBuildId,
  extractAllanimeDecryptedSources,
  hashAllanimeQuery,
  isAllanimeCaptchaMessage,
  resolveAllanimeSourceQueryHash,
} from "@/lib/scrape/anime/allanime-aareq";

describe("allanime aaReq helpers", () => {
  it("derives the XOR AES key from mask + partB", () => {
    const key = deriveAllanimeAaReqKey(
      "b1a9a4d051988f1b1b12dbb747439d9bd64b09ea17835600a7eaa4de87c1ad87",
      "k7DLdv5SGiuEyGUtcncl5wQOR7r4aenLfDV3AOBKlAU=",
    );
    expect(key).toHaveLength(32);
    expect(key.toString("hex")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes assembled sourceUrls episode query templates", () => {
    const chunk = `
      const frag = \`showId: $showId\`;
      const doc = \`query ($showId: String!) { episode(showId: $showId) { sourceUrls } }\`;
    `;
    const hash = resolveAllanimeSourceQueryHash(chunk);
    expect(hash).toBe(
      createHash("sha256")
        .update(
          "query ($showId: String!) { episode(showId: $showId) { sourceUrls } }",
        )
        .digest("hex"),
    );
  });

  it("derives the 2026-03 mask key and boot token", () => {
    const maskKey = deriveAllanimeMaskKey(ALLANIME_FALLBACK_MASK_PARTS, "140");
    expect(maskKey.toString("hex")).toBe(
      "522db8a067d8ea23616f7670788574dd786af7ffffd27bccfaeccfde57a67ce7",
    );
    expect(ALLANIME_BOOT_PREFIX).toBe("4X2PsZc2r:");
    expect(
      buildAllanimeBootToken(maskKey, "140", 2955, ALLANIME_EPISODE_LANE),
    ).toBe("351b496f677e5d86758b86ce0546bd64a9fabb7769adf6813d294f1756fb4d23");
  });

  it("still discovers legacy buildId ternaries", () => {
    expect(extractAllanimeBuildId(`Am=typeof x!=="string"?"119":""`)).toBe(
      "119",
    );
    expect(ALLANIME_EPISODE_QUERY_HASH_FALLBACK).toBe(
      hashAllanimeQuery(ALLANIME_EPISODE_QUERY_FALLBACK),
    );
    expect(ALLANIME_EPISODE_QUERY_HASH_FALLBACK).toBe(
      "753cdab91407b8bf846894f3baf373a140a8054dc59ab0b7d9bbd28c5ea87e97",
    );
  });

  it("reads sourceUrls from decrypted episode wrappers", () => {
    expect(extractAllanimeDecryptedSources({ sourceUrls: [] })).toEqual([]);
    expect(
      extractAllanimeDecryptedSources({
        episode: {
          sourceUrls: [{ sourceUrl: "https://cdn.example/a.mp4" }],
        },
      }),
    ).toEqual([{ sourceUrl: "https://cdn.example/a.mp4" }]);
  });

  it("detects AllAnime captcha lockouts", () => {
    expect(isAllanimeCaptchaMessage("NEED_CAPTCHA")).toBe(true);
    expect(isAllanimeCaptchaMessage("AA_CRYPTO_MISSING")).toBe(false);
  });

  it("resolves $-prefixed ternary fragment helpers like $r()", () => {
    const chunk = `
      const Kt = \`notes\`;
      const $r = (x) => x ? \`views\n\` : \`# ranks\nviews\n\`;
      const Ra = \`\${Kt}\`;
      const doc = \`query ($showId: String!) { episode(showId: $showId) { sourceUrls show { \${Ra} pageStatus { \${$r()} } } } }\`;
    `;
    const hash = resolveAllanimeSourceQueryHash(chunk);
    expect(hash).toBe(
      createHash("sha256")
        .update(
          "query ($showId: String!) { episode(showId: $showId) { sourceUrls show { notes pageStatus { # ranks\nviews\n } } } }",
        )
        .digest("hex"),
    );
  });
});
