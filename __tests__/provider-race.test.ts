import { describe, expect, it } from "vitest";

import {
  ANIME_PLAYBACK_SOLO_FIRST_PROVIDERS,
  deprioritizeProviders,
  getScrapeAttemptTimeoutMs,
  nextRaceBatch,
  pickRaceWinner,
  pickScoredRaceWinner,
  reorderProvidersWithPreferred,
  SCRAPE_ATTEMPT_TIMEOUT_MS,
  SCRAPE_DIRECT_ATTEMPT_TIMEOUT_MS,
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
    const { batch, nextIndex } = nextRaceBatch(order, 0, new Set(), 3);
    expect(batch).toEqual(["hentaigasm", "anipm", "anizone"]);
    expect(nextIndex).toBe(3);
  });

  it("races all TMDB scrapers in one batch when concurrency covers the order", () => {
    const order = [
      "direct",
      "bingr",
      "videasy",
      "vidking",
      "vidsrc",
      "2embed",
      "vidrock",
      "vixsrc",
      "vidnest",
    ] as const;
    const { batch, nextIndex } = nextRaceBatch(
      order,
      0,
      new Set(),
      9,
      new Set(),
    );
    expect(batch).toEqual([...order]);
    expect(nextIndex).toBe(order.length);
  });

  it("runs direct solo when solo-first is enabled", () => {
    const order = ["direct", "bingr", "videasy", "vidking"] as const;
    const first = nextRaceBatch(order, 0, new Set());
    expect(first.batch).toEqual(["direct"]);
    expect(first.nextIndex).toBe(1);

    const second = nextRaceBatch(order, first.nextIndex, new Set());
    expect(second.batch).toEqual(["bingr", "videasy", "vidking"]);
    expect(second.nextIndex).toBe(4);
  });

  it("races Direct with leading anime scrapers when solo-first is disabled", () => {
    const order = ["justanime", "kyren", "direct", "allmanga"] as const;
    const { batch, nextIndex } = nextRaceBatch(
      order,
      0,
      new Set(),
      3,
      ANIME_PLAYBACK_SOLO_FIRST_PROVIDERS,
    );

    expect(batch).toEqual(["justanime", "kyren", "direct"]);
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

describe("pickScoredRaceWinner", () => {
  const order = ["justanime", "animegg", "animepahe"] as const;

  it("prefers the highest score and breaks ties on order", () => {
    const winner = pickScoredRaceWinner(
      order,
      [
        {
          providerId: "animegg",
          attempt: {
            outcome: "success",
            payload: { score: 1 },
          },
        },
        {
          providerId: "animepahe",
          attempt: {
            outcome: "success",
            payload: { score: 5 },
          },
        },
      ],
      (payload) => payload.score,
    );

    expect(winner?.providerId).toBe("animepahe");
  });
});

describe("pickRaceWinner", () => {
  const order = ["vidsrc", "bingr", "vixsrc"] as const;

  it("prefers the earliest provider in order when several succeed", () => {
    const winner = pickRaceWinner(order, [
      { providerId: "vixsrc", attempt: { outcome: "success" } },
      { providerId: "vidsrc", attempt: { outcome: "success" } },
      { providerId: "bingr", attempt: { outcome: "failure" } },
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
  const order = ["vidsrc", "bingr", "vixsrc"] as const;

  it("pins preferred to the front without dropping other providers", () => {
    expect(reorderProvidersWithPreferred(order, "vixsrc")).toEqual([
      "vixsrc",
      "vidsrc",
      "bingr",
    ]);
  });

  it("returns the original order when preferred is missing", () => {
    expect(reorderProvidersWithPreferred(order, undefined)).toEqual(order);
  });
});

describe("deprioritizeProviders", () => {
  const order = ["vidking", "vidsrc", "bingr", "vixsrc"] as const;

  it("moves failed providers to the end without dropping any", () => {
    const failed = new Set<string>(["vidsrc", "vixsrc"]);
    expect(deprioritizeProviders(order, failed)).toEqual([
      "vidking",
      "bingr",
      "vidsrc",
      "vixsrc",
    ]);
  });

  it("never deprioritizes direct even after failure", () => {
    const withDirect = ["direct", "bingr", "vidsrc"] as const;
    const failed = new Set<string>(["direct", "vidsrc"]);
    expect(deprioritizeProviders(withDirect, failed)).toEqual([
      "direct",
      "bingr",
      "vidsrc",
    ]);
  });

  it("returns the original order when nothing failed", () => {
    expect(deprioritizeProviders(order, new Set())).toEqual(order);
  });
});

describe("getScrapeAttemptTimeoutMs", () => {
  it("gives Direct the full JSON budget when it runs alone", () => {
    expect(getScrapeAttemptTimeoutMs("direct")).toBe(
      SCRAPE_DIRECT_ATTEMPT_TIMEOUT_MS,
    );
  });

  it("caps Direct at 45s when racing siblings", () => {
    expect(getScrapeAttemptTimeoutMs("direct", true)).toBe(45_000);
  });

  it("keeps the full Direct budget when solo", () => {
    expect(getScrapeAttemptTimeoutMs("direct", false)).toBe(
      SCRAPE_DIRECT_ATTEMPT_TIMEOUT_MS,
    );
  });

  it("short-caps slow-fail scrapers", () => {
    expect(getScrapeAttemptTimeoutMs("vidrock", true)).toBe(8_000);
    expect(getScrapeAttemptTimeoutMs("vixsrc", true)).toBe(12_000);
    expect(getScrapeAttemptTimeoutMs("videasy", true)).toBe(60_000);
    expect(getScrapeAttemptTimeoutMs("vidking", true)).toBe(30_000);
    expect(getScrapeAttemptTimeoutMs("bingr", true)).toBe(30_000);
  });

  it("keeps the normal scrape budget for anime providers", () => {
    expect(getScrapeAttemptTimeoutMs("justanime", true)).toBe(
      SCRAPE_ATTEMPT_TIMEOUT_MS,
    );
  });
});
