import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("feature flags client fetch", () => {
  it("bypasses the browser cache on the flags request", () => {
    const source = readFileSync(
      resolve("components/providers/feature-flags-provider.tsx"),
      "utf8",
    );

    expect(source).toContain('fetch("/api/site/flags"');
    expect(source).toContain('cache: "no-store"');
  });
});
