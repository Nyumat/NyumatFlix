import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  deriveAllanimeAaReqKey,
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
