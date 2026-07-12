import { describe, expect, it } from "vitest";

import {
  nextRaceBatch,
  pickRaceWinner,
  reorderProvidersWithPreferred,
} from "@/lib/scrape/provider-race";

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

describe("pickRaceWinner", () => {
  const order = ["vidsrc", "vidsrc-mirror", "vixsrc"] as const;

  it("prefers the earliest provider in order when several succeed", () => {
    const winner = pickRaceWinner(order, [
      { providerId: "vixsrc", attempt: { outcome: "success" } },
      { providerId: "vidsrc", attempt: { outcome: "success" } },
      { providerId: "vidsrc-mirror", attempt: { outcome: "failure" } },
    ]);

    expect(winner?.providerId).toBe("vidsrc");
  });

  it("returns undefined when no provider succeeds", () => {
    expect(
      pickRaceWinner(order, [
        { providerId: "vixsrc", attempt: { outcome: "failure" } },
      ]),
    ).toBeUndefined();
  });
});

describe("reorderProvidersWithPreferred", () => {
  const order = ["vidsrc", "vidsrc-mirror", "vixsrc"] as const;

  it("pins preferred to the front without dropping other providers", () => {
    expect(reorderProvidersWithPreferred(order, "vixsrc")).toEqual([
      "vixsrc",
      "vidsrc",
      "vidsrc-mirror",
    ]);
  });

  it("returns the original order when preferred is missing", () => {
    expect(reorderProvidersWithPreferred(order, undefined)).toEqual(order);
  });
});
