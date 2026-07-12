import { describe, expect, it } from "vitest";

import { nextRaceBatch } from "@/lib/scrape/provider-race";

describe("nextRaceBatch", () => {
  const order = [
    "hentaigasm",
    "anipm",
    "anizone",
    "kickassanime",
    "animestream",
  ] as const;

  it("takes concurrency providers from the start index", () => {
    const { batch, nextIndex } = nextRaceBatch(order, 0, new Set());
    expect(batch).toEqual(["hentaigasm", "anipm", "anizone"]);
    expect(nextIndex).toBe(3);
  });

  it("skips failed providers and advances past them", () => {
    const failed = new Set<string>(["hentaigasm", "anipm"]);
    const { batch, nextIndex } = nextRaceBatch(order, 0, failed);
    expect(batch).toEqual(["anizone", "kickassanime", "animestream"]);
    expect(nextIndex).toBe(5);
  });

  it("continues forward from a preferred start index without wrapping", () => {
    const { batch, nextIndex } = nextRaceBatch(order, 2, new Set());
    expect(batch).toEqual(["anizone", "kickassanime", "animestream"]);
    expect(nextIndex).toBe(5);
  });

  it("returns an empty batch at the end of the order", () => {
    const { batch, nextIndex } = nextRaceBatch(order, order.length, new Set());
    expect(batch).toEqual([]);
    expect(nextIndex).toBe(order.length);
  });
});
