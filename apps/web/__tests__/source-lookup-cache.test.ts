import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAdjacentEpisodeTargets } from "@/lib/playback/adjacent-episodes";
import {
  createProviderLookupRunner,
  type ScrapeApiResponse,
} from "@/lib/playback/provider-lookup";
import {
  buildSourceLookupKey,
  createSourceLookupCache,
  type SourceLookupItemPatch,
  type SourceLookupRunner,
  type SourceLookupWinner,
} from "@/lib/playback/source-lookup-cache";
import { createMetadataCache } from "@/lib/scrape/metadata-cache";
import { resolveFirstBingrServer } from "@/lib/scrape/providers/bingr";
import { raceWingsdatabaseMirrors } from "@/lib/scrape/providers/vidking";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const winnerFor = (playUrl: string): SourceLookupWinner => ({
  providerId: "alpha",
  payload: { providerId: "alpha", providerName: "Alpha", playUrl },
});

describe("source lookup cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shares one in-flight request between prefetch and play", async () => {
    const cache = createSourceLookupCache();
    const pending = deferred<SourceLookupWinner | null>();
    const run = vi.fn<SourceLookupRunner>(() => pending.promise);

    const prefetch = cache.lookup("e1", run);
    const play = cache.lookup("e1", run);
    pending.resolve(winnerFor("https://cdn/e1.m3u8"));

    await expect(prefetch).resolves.toEqual({
      winner: winnerFor("https://cdn/e1.m3u8"),
      cached: false,
    });
    await expect(play).resolves.toMatchObject({ cached: false });
    expect(run).toHaveBeenCalledTimes(1);
    await expect(cache.lookup("e1", run)).resolves.toMatchObject({
      cached: true,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("replays provider progress to a caller that joins late", async () => {
    const cache = createSourceLookupCache();
    const pending = deferred<SourceLookupWinner | null>();
    let report: (patch: SourceLookupItemPatch) => void = () => undefined;
    const run: SourceLookupRunner = ({ reportItem }) => {
      report = reportItem;
      return pending.promise;
    };

    void cache.lookup("e1", run);
    report({ providerId: "alpha", status: "pending" });
    const seen: SourceLookupItemPatch[] = [];
    const joined = cache.lookup("e1", run, {
      onItem: (patch) => seen.push(patch),
    });
    report({ providerId: "alpha", status: "success" });
    pending.resolve(winnerFor("https://cdn/e1.m3u8"));
    await joined;

    expect(seen.map((patch) => patch.status)).toEqual(["pending", "success"]);
  });

  it("keeps a play request alive when the prefetch is cancelled in the same commit", async () => {
    const cache = createSourceLookupCache();
    const pending = deferred<SourceLookupWinner | null>();
    const captured: { signal?: AbortSignal } = {};
    const run: SourceLookupRunner = ({ signal }) => {
      captured.signal = signal;
      return pending.promise;
    };

    const prefetchController = new AbortController();
    void cache.lookup("e1", run, { signal: prefetchController.signal });
    prefetchController.abort();
    const play = cache.lookup("e1", run);
    await vi.runAllTimersAsync();

    expect(captured.signal?.aborted).toBe(false);
    pending.resolve(winnerFor("https://cdn/e1.m3u8"));
    await expect(play).resolves.toMatchObject({ cached: false });
  });

  it("aborts the request once every caller has gone", async () => {
    const cache = createSourceLookupCache();
    const captured: { signal?: AbortSignal } = {};
    const run: SourceLookupRunner = ({ signal }) => {
      captured.signal = signal;
      return new Promise(() => undefined);
    };

    const controller = new AbortController();
    const outcome = cache.lookup("e1", run, { signal: controller.signal });
    controller.abort();
    await expect(outcome).resolves.toEqual({ winner: null, cached: false });
    await vi.runAllTimersAsync();

    expect(captured.signal?.aborted).toBe(true);
    expect(cache.isInFlight("e1")).toBe(false);
  });

  it("keeps at most three results and expires them after the ttl", async () => {
    let clock = 0;
    const cache = createSourceLookupCache({ now: () => clock });
    for (const key of ["e1", "e2", "e3", "e4"]) {
      await cache.lookup(key, async () => winnerFor(`https://cdn/${key}`));
    }

    expect(cache.peek("e1")).toBeNull();
    expect(cache.peek("e4")?.payload.playUrl).toBe("https://cdn/e4");

    clock = 60_001;
    expect(cache.peek("e4")).toBeNull();
  });

  it("never caches failures", async () => {
    const cache = createSourceLookupCache();
    const run = vi.fn<SourceLookupRunner>(async () => null);

    await cache.lookup("e1", run);
    await cache.lookup("e1", run);

    expect(run).toHaveBeenCalledTimes(2);
    expect(cache.peek("e1")).toBeNull();
  });

  it("runs a fresh lookup after eviction or when asked", async () => {
    const cache = createSourceLookupCache();
    const run = vi.fn<SourceLookupRunner>(async () =>
      winnerFor("https://cdn/e1"),
    );

    await cache.lookup("e1", run);
    await cache.lookup("e1", run, { fresh: true });
    cache.evict("e1");
    await cache.lookup("e1", run);

    expect(run).toHaveBeenCalledTimes(3);
  });

  it("keys lookups by episode, provider choice, and provider order", () => {
    expect(
      buildSourceLookupKey({
        lookupKey: "tv:1:1:2|multi|ja",
        providerOrder: ["alpha", "beta"],
      }),
    ).toBe("tv:1:1:2|multi|ja|auto|alpha,beta");
    expect(
      buildSourceLookupKey({
        lookupKey: "tv:1:1:2|multi|ja",
        providerOrder: ["beta", "alpha"],
        pinnedProviderId: "beta",
      }),
    ).toBe("tv:1:1:2|multi|ja|beta|beta,alpha");
  });
});

describe("provider lookup runner", () => {
  const ok = (providerId: string): ScrapeApiResponse => ({
    ok: true,
    providerId,
    providerName: providerId,
    playUrl: `https://cdn/${providerId}.m3u8`,
  });

  it("tries an explicitly chosen provider before racing the rest", async () => {
    const requested: string[] = [];
    const run = createProviderLookupRunner({
      providerOrder: ["alpha", "beta", "gamma"],
      pinnedProviderId: "beta",
      buildBody: (providerId) => ({ providerId }),
      requestScrape: async (body) => {
        requested.push(String(body.providerId));
        return ok(String(body.providerId));
      },
    });

    const winner = await run({
      signal: new AbortController().signal,
      reportItem: () => undefined,
    });

    expect(winner?.providerId).toBe("beta");
    expect(requested).toEqual(["beta"]);
  });

  it("reports failures and falls through to the next provider", async () => {
    const patches: SourceLookupItemPatch[] = [];
    const run = createProviderLookupRunner({
      providerOrder: ["alpha", "beta"],
      pinnedProviderId: "alpha",
      buildBody: (providerId) => ({ providerId }),
      requestScrape: async (body) =>
        body.providerId === "alpha"
          ? { ok: false, error: "Not found" }
          : { ...ok("beta"), subtitlesDeferred: true },
    });

    const winner = await run({
      signal: new AbortController().signal,
      reportItem: (patch) => patches.push(patch),
    });

    expect(winner).toMatchObject({
      providerId: "beta",
      subtitlesDeferred: true,
    });
    expect(patches).toContainEqual({
      providerId: "alpha",
      status: "failure",
      error: "Not found",
    });
  });
});

describe("adjacent episode targets", () => {
  const seasonEpisodes = [3, 1, 2, 4].map((episode_number) => ({
    episode_number,
  }));

  it("returns next then previous with provider numbering", () => {
    expect(
      resolveAdjacentEpisodeTargets({ seasonEpisodes, episodeNumber: 2 }),
    ).toEqual([
      {
        episodeNumber: 3,
        providerEpisodeNumber: 3,
        relativeEpisodeNumber: null,
      },
      {
        episodeNumber: 1,
        providerEpisodeNumber: 1,
        relativeEpisodeNumber: null,
      },
    ]);
  });

  it("stays inside the anime segment", () => {
    expect(
      resolveAdjacentEpisodeTargets({
        seasonEpisodes,
        episodeNumber: 3,
        relativeEpisodeNumber: 1,
        animeSegmentStart: 3,
        animeSegmentEnd: 4,
      }),
    ).toEqual([
      { episodeNumber: 4, providerEpisodeNumber: 4, relativeEpisodeNumber: 2 },
    ]);
  });

  it("returns nothing without season data", () => {
    expect(
      resolveAdjacentEpisodeTargets({ seasonEpisodes: null, episodeNumber: 1 }),
    ).toEqual([]);
  });
});

describe("scrape metadata cache", () => {
  it("dedupes in-flight loads and does not store null", async () => {
    let clock = 0;
    const cache = createMetadataCache<string>({
      ttlMs: 1_000,
      maxEntries: 2,
      now: () => clock,
    });
    const load = vi.fn(async () => "details");

    await Promise.all([cache.get("a", load), cache.get("a", load)]);
    expect(load).toHaveBeenCalledTimes(1);

    const missing = vi.fn(async () => null);
    await cache.get("b", missing);
    await cache.get("b", missing);
    expect(missing).toHaveBeenCalledTimes(2);

    clock = 1_001;
    await cache.get("a", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("bingr server race", () => {
  it("races the first two servers and uses the fastest success", async () => {
    const started: string[] = [];
    const success = await resolveFirstBingrServer(
      ["s3", "s2", "s1"],
      async (server) => {
        started.push(server);
        if (server === "s3") {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return {
          ok: true,
          providerId: "bingr",
          validated: true,
          streamUrl: `https://cdn/${server}.m3u8`,
          referer: "https://bingr",
        };
      },
    );

    expect(success?.streamUrl).toBe("https://cdn/s2.m3u8");
    expect(started).toEqual(["s3", "s2"]);
  });

  it("falls back to remaining servers when the race fails", async () => {
    const success = await resolveFirstBingrServer(
      ["s3", "s2", "s1"],
      async (server) =>
        server === "s1"
          ? {
              ok: true,
              providerId: "bingr",
              validated: true,
              streamUrl: "https://cdn/s1.m3u8",
              referer: "https://bingr",
            }
          : null,
    );

    expect(success?.streamUrl).toBe("https://cdn/s1.m3u8");
  });
});

describe("wingsdatabase mirror race", () => {
  it("probes the first mirror's candidates without waiting for slow mirrors", async () => {
    const slow: { signal?: AbortSignal } = {};
    const race = await raceWingsdatabaseMirrors({
      mirrors: ["cdn/sources-with-title", "downloader2/sources-with-title"],
      referer: "https://vidking",
      fetchPayload: async (mirror, signal) => {
        if (mirror.startsWith("downloader2")) {
          slow.signal = signal;
          return new Promise(() => undefined);
        }
        return {
          sources: [
            {
              quality: "1080p",
              url: "https://moon.ironbubble.site/r2/cdn2/tok/1080p/index.m3u8",
            },
          ],
        };
      },
      probe: async (_url, referer) => referer,
    });

    expect(race.winner?.candidate.streamUrl).toContain("1080p");
    expect(slow.signal?.aborted).toBe(true);
  });

  it("resolves null when no candidate validates", async () => {
    const race = await raceWingsdatabaseMirrors({
      mirrors: ["cdn/sources-with-title"],
      referer: "https://vidking",
      fetchPayload: async () => ({
        sources: [
          {
            quality: "720p",
            url: "https://moon.ironbubble.site/r2/cdn2/tok/720p/index.m3u8",
          },
        ],
      }),
      probe: async () => null,
    });

    expect(race.winner).toBeNull();
    expect(race.candidates).toHaveLength(1);
  });
});
