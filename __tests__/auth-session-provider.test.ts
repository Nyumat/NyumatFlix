import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth session provider", () => {
  it("does not default session to null, which next-auth treats as logged out", () => {
    const source = readFileSync(
      resolve("components/providers/session-provider.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/session\s*=\s*null/);
    expect(source).toContain("SessionProvider");
  });
});
