import { getDevMagicLink, setDevMagicLink } from "@/lib/dev-magic-link-store";
import { beforeEach, describe, expect, test } from "vitest";

describe("dev-magic-link-store", () => {
  beforeEach(() => {
    getDevMagicLink("test@example.com");
    getDevMagicLink("other@example.com");
  });

  describe("setDevMagicLink", () => {
    test("stores a magic link for an email", () => {
      setDevMagicLink("test@example.com", "https://example.com/magic-link");

      const result = getDevMagicLink("test@example.com");

      expect(result).toBe("https://example.com/magic-link");
    });

    test("overwrites existing link for same email", () => {
      setDevMagicLink("test@example.com", "https://example.com/first-link");
      setDevMagicLink("test@example.com", "https://example.com/second-link");

      const result = getDevMagicLink("test@example.com");

      expect(result).toBe("https://example.com/second-link");
    });
  });

  describe("getDevMagicLink", () => {
    test("returns undefined for non-existent email", () => {
      const result = getDevMagicLink("nonexistent@example.com");

      expect(result).toBeUndefined();
    });

    test("returns the stored link", () => {
      setDevMagicLink("test@example.com", "https://example.com/magic-link");

      const result = getDevMagicLink("test@example.com");

      expect(result).toBe("https://example.com/magic-link");
    });

    test("deletes the link after retrieval (one-time use)", () => {
      setDevMagicLink("test@example.com", "https://example.com/magic-link");

      const firstResult = getDevMagicLink("test@example.com");
      expect(firstResult).toBe("https://example.com/magic-link");

      const secondResult = getDevMagicLink("test@example.com");
      expect(secondResult).toBeUndefined();
    });

    test("handles multiple emails independently", () => {
      setDevMagicLink("user1@example.com", "https://example.com/link1");
      setDevMagicLink("user2@example.com", "https://example.com/link2");

      const result1 = getDevMagicLink("user1@example.com");
      const result2 = getDevMagicLink("user2@example.com");

      expect(result1).toBe("https://example.com/link1");
      expect(result2).toBe("https://example.com/link2");
    });

    test("getting one email does not affect others", () => {
      setDevMagicLink("user1@example.com", "https://example.com/link1");
      setDevMagicLink("user2@example.com", "https://example.com/link2");

      getDevMagicLink("user1@example.com");

      const result = getDevMagicLink("user2@example.com");
      expect(result).toBe("https://example.com/link2");
    });
  });
});
