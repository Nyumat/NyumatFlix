import type { AniListMedia, AniListPage } from "@/lib/anilist-shared";
import {
  resolveAnimeCatalogFallbackEffect,
  resolveAnimeSearchFallbackEffect,
  type AnimeCatalogFallbackProviders,
  type AnimeSearchFallbackProviders,
} from "@/lib/server/anime-catalog-flow";
import {
  CatalogProviderError,
  fetchResponseEffect,
  readJsonEffect,
  requireOkResponse,
  runCatalogEffect,
} from "@/lib/server/catalog-effect";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const media = (id: number): AniListMedia => ({
  id,
  title: { english: `Anime ${id}` },
  type: "ANIME",
  format: "TV",
  coverImage: { large: `/poster-${id}.jpg` },
});

const page = (
  items: AniListMedia[],
  currentPage = 1,
  perPage = 20,
): AniListPage => ({
  pageInfo: {
    currentPage,
    lastPage: currentPage,
    hasNextPage: false,
    total: items.length,
    perPage,
  },
  media: items,
});

const input = (genres: string[] = []) => ({
  page: 2,
  perPage: 20,
  params: {
    medium: "ANIME" as const,
    sort: "TRENDING_DESC" as const,
    genres,
  },
  reason: "AniList unavailable",
});

const failure = (provider: "kitsu" | "tmdb" | "jikan") =>
  new CatalogProviderError({
    provider,
    kind: "transport",
    message: `${provider} failed`,
  });

describe("catalog Effect primitives", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the original typed error across the Promise boundary", async () => {
    const error = failure("kitsu");
    await expect(runCatalogEffect(Effect.fail(error))).rejects.toBe(error);
  });

  it("classifies HTTP and JSON failures", async () => {
    await expect(
      runCatalogEffect(
        requireOkResponse("kitsu", new Response(null, { status: 503 })),
      ),
    ).rejects.toMatchObject({
      _tag: "CatalogProviderError",
      kind: "http",
      provider: "kitsu",
      status: 503,
    });

    await expect(
      runCatalogEffect(
        readJsonEffect("jikan", new Response("not json", { status: 200 })),
      ),
    ).rejects.toMatchObject({
      _tag: "CatalogProviderError",
      kind: "decode",
      provider: "jikan",
    });
  });

  it("aborts the native request when the Effect timeout wins", async () => {
    let aborted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              aborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    await expect(
      runCatalogEffect(
        fetchResponseEffect({
          provider: "anilist",
          input: "https://graphql.anilist.co",
          timeoutMs: 1,
        }),
      ),
    ).rejects.toMatchObject({ kind: "timeout", provider: "anilist" });
    expect(aborted).toBe(true);
  });
});

describe("anime catalog Effect orchestration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("short-circuits at the first non-empty provider", async () => {
    const kitsu = vi.fn(() => Effect.succeed(page([media(1)])));
    const tmdb = vi.fn(() => Effect.succeed(page([media(2)])));
    const jikan = vi.fn(() => Effect.succeed(page([media(3)])));

    const result = await runCatalogEffect(
      resolveAnimeCatalogFallbackEffect(input(), { kitsu, tmdb, jikan }),
    );

    expect(result.media.map(({ id }) => id)).toEqual([1]);
    expect(kitsu).toHaveBeenCalledOnce();
    expect(tmdb).not.toHaveBeenCalled();
    expect(jikan).not.toHaveBeenCalled();
  });

  it("continues from failed Kitsu and TMDB to Jikan in order", async () => {
    const order: string[] = [];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const providers: AnimeCatalogFallbackProviders = {
      kitsu: () => {
        order.push("kitsu");
        return Effect.fail(failure("kitsu"));
      },
      tmdb: () => {
        order.push("tmdb");
        return Effect.fail(failure("tmdb"));
      },
      jikan: () => {
        order.push("jikan");
        return Effect.succeed(page([media(3)]));
      },
    };

    const result = await runCatalogEffect(
      resolveAnimeCatalogFallbackEffect(input(), providers),
    );

    expect(order).toEqual(["kitsu", "tmdb", "jikan"]);
    expect(result.media.map(({ id }) => id)).toEqual([3]);
  });

  it("returns requested pagination when every provider is empty", async () => {
    const empty = () => Effect.succeed(null);
    const result = await runCatalogEffect(
      resolveAnimeCatalogFallbackEffect(input(), {
        kitsu: empty,
        tmdb: empty,
        jikan: empty,
      }),
    );

    expect(result).toEqual(page([], 2, 20));
  });

  it("does not invoke fallback providers for adult catalog queries", async () => {
    const kitsu = vi.fn(() => Effect.succeed(page([media(1)])));
    const tmdb = vi.fn(() => Effect.succeed(page([media(2)])));
    const jikan = vi.fn(() => Effect.succeed(page([media(3)])));

    const result = await runCatalogEffect(
      resolveAnimeCatalogFallbackEffect(input(["Hentai"]), {
        kitsu,
        tmdb,
        jikan,
      }),
    );

    expect(result).toEqual(page([], 2, 20));
    expect(kitsu).not.toHaveBeenCalled();
    expect(tmdb).not.toHaveBeenCalled();
    expect(jikan).not.toHaveBeenCalled();
  });

  it("keeps search limited to Kitsu then Jikan", async () => {
    const order: string[] = [];
    const providers: AnimeSearchFallbackProviders = {
      kitsu: () => {
        order.push("kitsu");
        return Effect.succeed(null);
      },
      jikan: () => {
        order.push("jikan");
        return Effect.succeed(null);
      },
    };

    const result = await runCatalogEffect(
      resolveAnimeSearchFallbackEffect(input(), providers),
    );

    expect(order).toEqual(["kitsu", "jikan"]);
    expect(result).toEqual({
      items: [],
      page: 2,
      totalPages: 1,
      totalResults: 0,
    });
  });
});
